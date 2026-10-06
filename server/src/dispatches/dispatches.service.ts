import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BatteryStatus, BatchStatus } from '../domain.constants';
import { AcknowledgeDto, CreateDispatchDto } from './dto/dispatch.dto';

@Injectable()
export class DispatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 暂存旧件发给回收商，建立批次与逐件明细 */
  async create(dto: CreateDispatchDto) {
    const serials = [...new Set(dto.serialNumbers.map((s) => s.trim()))];
    if (serials.length === 0) {
      throw new BadRequestException('至少选择一件旧件发出');
    }

    const batteries = await this.prisma.oldBattery.findMany({
      where: { serialNumber: { in: serials } },
      include: { dispatchItem: true },
    });

    const foundMap = new Map(batteries.map((b) => [b.serialNumber, b]));
    const missing = serials.filter((s) => !foundMap.has(s));
    if (missing.length) {
      throw new BadRequestException(
        `以下旧件编号无实物入库记录，不能发出：${missing.join('、')}`,
      );
    }

    const notStaged = batteries.filter(
      (b) => b.status !== BatteryStatus.STAGED || b.dispatchItem,
    );
    if (notStaged.length) {
      throw new ConflictException(
        `以下旧件已发出或不在暂存状态，不能重复发货：${notStaged
          .map((b) => b.serialNumber)
          .join('、')}`,
      );
    }

    const batchNo = await this.nextBatchNo();
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.dispatchBatch.create({
        data: {
          batchNo,
          recyclerName: dto.recyclerName,
          operator: dto.operator,
          note: dto.note,
          shippedCount: serials.length,
          status: BatchStatus.SHIPPED,
        },
      });

      await tx.dispatchItem.createMany({
        data: batteries.map((b) => ({
          batchId: batch.id,
          batteryId: b.id,
        })),
      });

      await tx.oldBattery.updateMany({
        where: { id: { in: batteries.map((b) => b.id) } },
        data: { status: BatteryStatus.DISPATCHED },
      });

      return tx.dispatchBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: { items: { include: { battery: true } } },
      });
    });
  }

  /**
   * 回收商电子签收回执：
   * - 重复签收回执只能记一次（批次唯一回执）
   * - 实收数与发出数不符 → PENDING_RECONCILIATION，保留差额，绝不改成一致
   */
  async acknowledge(batchId: number, dto: AcknowledgeDto) {
    const batch = await this.prisma.dispatchBatch.findUnique({
      where: { id: batchId },
      include: {
        acknowledgment: true,
        items: { include: { battery: true } },
      },
    });
    if (!batch) {
      throw new NotFoundException(`未找到发货批次 #${batchId}`);
    }
    if (batch.acknowledgment) {
      throw new ConflictException(
        `批次 ${batch.batchNo} 已有签收回执（${batch.acknowledgment.signedBy} 于 ${batch.acknowledgment.signedAt.toISOString()} 签收），重复签收只能记一次`,
      );
    }

    const receivedSerials = dto.receivedSerials ?? [];
    const validSerials = [...new Set(receivedSerials.map((s) => s.trim()))];

    if (validSerials.length > 0) {
      const serialSet = new Set(batch.items.map((i) => i.battery.serialNumber));
      const notInBatch = validSerials.filter((s) => !serialSet.has(s));
      if (notInBatch.length) {
        throw new BadRequestException(
          `回执编号不属于本批次：${notInBatch.join('、')}`,
        );
      }
      // 编号与数量必须自洽：收到的编号数不能多于声称收到的数量
      if (validSerials.length > dto.receivedCount) {
        throw new BadRequestException(
          `按编号收到 ${validSerials.length} 件，多于填报实收数 ${dto.receivedCount}`,
        );
      }
    }

    const difference = batch.shippedCount - dto.receivedCount;
    const matched = difference === 0 &&
      (validSerials.length === 0 ||
        validSerials.length === batch.shippedCount);
    const status = matched
      ? BatchStatus.ACKNOWLEDGED
      : BatchStatus.PENDING_RECONCILIATION;

    try {
      const ack = await this.prisma.$transaction(async (tx) => {
        const created = await tx.dispatchAcknowledgment.create({
          data: {
            dispatchId: batch.id,
            receivedCount: dto.receivedCount,
            receivedSerials: JSON.stringify(validSerials),
            signedBy: dto.signedBy,
            signatureData: dto.signatureData,
            note: dto.note,
          },
        });

        await tx.dispatchBatch.update({
          where: { id: batch.id },
          data: {
            receivedCount: dto.receivedCount,
            differenceCount: difference, // 保留差额
            status,
            acknowledgedAt: new Date(),
          },
        });

        if (validSerials.length > 0) {
          const receivedBatteryIds = batch.items
            .filter((i) => validSerials.includes(i.battery.serialNumber))
            .map((i) => i.batteryId);
          // 按编号标记逐件收到
          await tx.dispatchItem.updateMany({
            where: { batteryId: { in: receivedBatteryIds } },
            data: { received: true },
          });
          // 完全匹配才把旧件状态推进到 ACKNOWLEDGED；否则保持 DISPATCHED 便于逐件核实
          if (matched) {
            await tx.oldBattery.updateMany({
              where: { id: { in: batch.items.map((i) => i.batteryId) } },
              data: { status: BatteryStatus.ACKNOWLEDGED },
            });
          }
        } else if (matched) {
          await tx.oldBattery.updateMany({
            where: { id: { in: batch.items.map((i) => i.batteryId) } },
            data: { status: BatteryStatus.ACKNOWLEDGED },
          });
        }

        return created;
      });

      return this.prisma.dispatchBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: {
          items: { include: { battery: true } },
          acknowledgment: true,
        },
      });
    } catch (e) {
      // 唯一约束兜底：并发重复回执
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('该批次已签收，重复回执只能记一次');
      }
      throw e;
    }
  }

  async findAll() {
    return this.prisma.dispatchBatch.findMany({
      orderBy: { dispatchedAt: 'desc' },
      include: {
        items: { include: { battery: true } },
        acknowledgment: true,
      },
    });
  }

  async findOne(batchId: number) {
    const batch = await this.prisma.dispatchBatch.findUnique({
      where: { id: batchId },
      include: {
        items: { include: { battery: true } },
        acknowledgment: true,
      },
    });
    if (!batch) {
      throw new NotFoundException(`未找到发货批次 #${batchId}`);
    }
    return batch;
  }

  private async nextBatchNo() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const count = await this.prisma.dispatchBatch.count({
      where: { dispatchedAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
    });
    return `FH-${y}${m}${d}-${String(count + 1).padStart(3, '0')}`;
  }
}
