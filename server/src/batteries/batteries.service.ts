import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BatteryStatus } from '../domain.constants';
import { IntakeBatteryDto, ReweighDto } from './dto/battery.dto';

@Injectable()
export class BatteriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 入库登记：无实物核实拒绝；同一编号再次入库拦截 */
  async intake(dto: IntakeBatteryDto) {
    if (!dto.physicalVerified) {
      throw new BadRequestException(
        '未核实旧件实物，不能登记入库，也不能开具回收凭证',
      );
    }

    const existing = await this.prisma.oldBattery.findUnique({
      where: { serialNumber: dto.serialNumber.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `旧件编号 ${dto.serialNumber} 已入库（${existing.status}），同一编号不能重复入库`,
      );
    }

    try {
      return await this.prisma.oldBattery.create({
        data: {
          serialNumber: dto.serialNumber.trim(),
          vehiclePlate: dto.vehiclePlate,
          vehicleModel: dto.vehicleModel,
          customerName: dto.customerName,
          weightKg: dto.weightKg,
          physicalVerifiedAt: new Date(),
          intakeOperator: dto.intakeOperator,
          intakeNote: dto.intakeNote,
          status: BatteryStatus.STAGED,
        },
      });
    } catch (e) {
      // 并发下唯一约束兜底
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `旧件编号 ${dto.serialNumber} 已存在，重复入库被拒绝`,
        );
      }
      throw e;
    }
  }

  async findAll(status?: string) {
    return this.prisma.oldBattery.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        weightRecords: { orderBy: { createdAt: 'desc' } },
        dispatchItem: { include: { batch: true } },
      },
    });
  }

  async findBySerial(serial: string) {
    const battery = await this.prisma.oldBattery.findUnique({
      where: { serialNumber: serial },
      include: {
        weightRecords: { orderBy: { createdAt: 'asc' } },
        receipt: true,
        dispatchItem: { include: { batch: { include: { acknowledgment: true } } } },
      },
    });
    if (!battery) {
      throw new NotFoundException(`未找到旧件编号 ${serial}`);
    }
    return battery;
  }

  /** 复称：原重量与新测量值都保留 */
  async reweigh(serial: string, dto: ReweighDto) {
    const battery = await this.prisma.oldBattery.findUnique({
      where: { serialNumber: serial },
    });
    if (!battery) {
      throw new NotFoundException(`未找到旧件编号 ${serial}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.weightRecord.create({
        data: {
          batteryId: battery.id,
          previousWeightKg: battery.weightKg,
          newWeightKg: dto.newWeightKg,
          operator: dto.operator,
          reason: dto.reason,
        },
      });
      await tx.oldBattery.update({
        where: { id: battery.id },
        data: { weightKg: dto.newWeightKg },
      });
      return record;
    });
  }

  async getWeightHistory(serial: string) {
    const battery = await this.findBySerial(serial);
    return this.prisma.weightRecord.findMany({
      where: { batteryId: battery.id },
      orderBy: { createdAt: 'asc' },
    });
  }
}
