import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntakeStatus } from '../common/status';
import { CreateIntakeDto, ReweighDto } from './dto';

@Injectable()
export class IntakeService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIntakeDto) {
    // 规则：没有收到实物不能登记（后续也不能开回收凭证）
    if (!dto.physicalVerified) {
      throw new BadRequestException('未核实旧件实物，不能登记入库；没有收到实物也不能开具回收凭证');
    }
    // 规则：同一编号再次入库须拦截（预检 + 数据库唯一约束兜底）
    const existing = await this.prisma.intake.findUnique({ where: { serialNo: dto.serialNo } });
    if (existing) {
      throw new ConflictException(`旧件编号 ${dto.serialNo} 已入库，同一编号不能重复入库`);
    }
    try {
      return await this.prisma.intake.create({
        data: {
          serialNo: dto.serialNo,
          vehiclePlate: dto.vehiclePlate,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          physicalVerified: true,
          initialWeightKg: dto.weightKg,
          currentWeightKg: dto.weightKg,
          status: IntakeStatus.STORED,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`旧件编号 ${dto.serialNo} 已入库，同一编号不能重复入库`);
      }
      throw e;
    }
  }

  findAll(status?: string) {
    return this.prisma.intake.findMany({
      where: status ? { status } : undefined,
      include: { voucher: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const intake = await this.prisma.intake.findUnique({
      where: { id },
      include: { voucher: true, weighings: { orderBy: { createdAt: 'asc' } } },
    });
    if (!intake) throw new NotFoundException('旧件不存在');
    return intake;
  }

  // 复称：保存原重量及新测量值，历史留痕
  async reweigh(id: string, dto: ReweighDto) {
    const intake = await this.prisma.intake.findUnique({ where: { id } });
    if (!intake) throw new NotFoundException('旧件不存在');
    const [weighing, updated] = await this.prisma.$transaction([
      this.prisma.weighing.create({
        data: {
          intakeId: id,
          originalWeightKg: intake.currentWeightKg,
          newWeightKg: dto.newWeightKg,
          reason: dto.reason,
        },
      }),
      this.prisma.intake.update({ where: { id }, data: { currentWeightKg: dto.newWeightKg } }),
    ]);
    return { weighing, intake: updated };
  }
}
