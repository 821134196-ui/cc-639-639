import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntakeStatus, ShipmentStatus } from '../common/status';
import { CreateShipmentDto } from './dto';

const INCLUDE_FULL = {
  items: { include: { intake: true } },
  receipts: { include: { items: { include: { intake: true } } } },
} as const;

@Injectable()
export class ShipmentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateShipmentDto) {
    const serialNos = [...new Set(dto.serialNos)];
    const intakes = await this.prisma.intake.findMany({ where: { serialNo: { in: serialNos } } });
    const found = new Set(intakes.map((i) => i.serialNo));
    const missing = serialNos.filter((s) => !found.has(s));
    if (missing.length) {
      throw new BadRequestException(`旧件未入库：${missing.join('、')}`);
    }
    const notStored = intakes.filter((i) => i.status !== IntakeStatus.STORED);
    if (notStored.length) {
      throw new ConflictException(`以下旧件不在暂存状态，不能发货：${notStored.map((i) => i.serialNo).join('、')}`);
    }
    const count = await this.prisma.shipment.count();
    const shipmentNo = `SHP-${String(count + 1).padStart(4, '0')}`;
    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          shipmentNo,
          recyclerName: dto.recyclerName,
          // 发出重量取当前重量快照，之后实收不符也不改写
          items: { create: intakes.map((i) => ({ intakeId: i.id, sentWeightKg: i.currentWeightKg })) },
        },
      });
      await tx.intake.updateMany({
        where: { id: { in: intakes.map((i) => i.id) } },
        data: { status: IntakeStatus.SHIPPED },
      });
      return created;
    });
    return this.findOne(shipment.id);
  }

  findAll() {
    return this.prisma.shipment.findMany({ include: INCLUDE_FULL, orderBy: { shippedAt: 'desc' } });
  }

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id }, include: INCLUDE_FULL });
    if (!shipment) throw new NotFoundException('发货批次不存在');
    return shipment;
  }

  // 待核实列表：实收与发出不符的批次
  findDiscrepancies() {
    return this.prisma.shipment.findMany({
      where: { status: ShipmentStatus.PENDING_VERIFICATION },
      include: INCLUDE_FULL,
      orderBy: { shippedAt: 'desc' },
    });
  }
}
