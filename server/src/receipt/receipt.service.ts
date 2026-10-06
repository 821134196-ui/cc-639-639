import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IntakeStatus, MatchStatus, ShipmentStatus } from '../common/status';
import { CreateReceiptDto } from './dto';

@Injectable()
export class ReceiptService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReceiptDto) {
    // 规则：重复签收回执只记一次 —— 同一回执号幂等返回原记录
    const existing = await this.prisma.receipt.findUnique({ where: { receiptNo: dto.receiptNo } });
    if (existing) {
      return { receipt: await this.findOne(existing.id), duplicate: true };
    }
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: dto.shipmentId },
      include: { items: { include: { intake: true } } },
    });
    if (!shipment) throw new NotFoundException('发货批次不存在');

    const bySerial = new Map(shipment.items.map((it) => [it.intake.serialNo, it]));
    const unknown = dto.items.filter((i) => !bySerial.has(i.serialNo)).map((i) => i.serialNo);
    if (unknown.length) {
      throw new BadRequestException(`回执包含本批次未发出的旧件编号：${unknown.join('、')}`);
    }

    // 电子签收本地模拟：由回执号、签收人、批次生成签名哈希
    const signatureData =
      'SIG-' +
      createHash('sha256').update(`${dto.receiptNo}|${dto.signerName}|${shipment.id}`).digest('hex').slice(0, 16).toUpperCase();

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.receipt.create({
        data: {
          receiptNo: dto.receiptNo,
          shipmentId: shipment.id,
          signerName: dto.signerName,
          signatureData,
        },
      });
      const receivedBySerial = new Map(dto.items.map((i) => [i.serialNo, i.receivedWeightKg]));
      let allMatched = true;
      for (const item of shipment.items) {
        const serial = item.intake.serialNo;
        const has = receivedBySerial.has(serial);
        const receivedWeightKg = has ? receivedBySerial.get(serial)! : null;
        const matchStatus = !has
          ? MatchStatus.MISSING
          : Math.abs(receivedWeightKg! - item.sentWeightKg) < 0.001
            ? MatchStatus.MATCHED
            : MatchStatus.MISMATCH;
        if (matchStatus !== MatchStatus.MATCHED) allMatched = false;
        await tx.receiptItem.create({
          data: { receiptId: created.id, intakeId: item.intakeId, receivedWeightKg, matchStatus },
        });
        await tx.intake.update({
          where: { id: item.intakeId },
          data: { status: matchStatus === MatchStatus.MATCHED ? IntakeStatus.RECEIVED : IntakeStatus.DISPUTED },
        });
      }
      // 规则：实收数与发出数不符 → 待核实，差额保留，不把发出数改成一致
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: allMatched ? ShipmentStatus.CONFIRMED : ShipmentStatus.PENDING_VERIFICATION },
      });
      return created;
    });

    return { receipt: await this.findOne(receipt.id), duplicate: false };
  }

  async findOne(id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: { items: { include: { intake: true } }, shipment: { include: { items: true } } },
    });
    if (!receipt) throw new NotFoundException('回执不存在');
    return receipt;
  }

  async findByNo(receiptNo: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { receiptNo },
      include: { items: { include: { intake: true } } },
    });
    if (!receipt) throw new NotFoundException(`回执 ${receiptNo} 不存在`);
    return receipt;
  }
}
