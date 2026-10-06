import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto } from './dto';

@Injectable()
export class VoucherService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVoucherDto) {
    const intake = await this.prisma.intake.findUnique({ where: { serialNo: dto.serialNo } });
    // 规则：没有收到实物（旧件未核实入库）不能开回收凭证
    if (!intake || !intake.physicalVerified) {
      throw new BadRequestException(`旧件 ${dto.serialNo} 未核实入库：没有收到实物，不能开具回收凭证`);
    }
    // 一件旧件只开一张凭证；重复请求幂等返回原凭证
    const existing = await this.prisma.voucher.findUnique({
      where: { intakeId: intake.id },
      include: { intake: true },
    });
    if (existing) {
      return { voucher: existing, alreadyIssued: true };
    }
    const voucherNo = await this.nextVoucherNo();
    try {
      const voucher = await this.prisma.voucher.create({
        data: {
          voucherNo,
          intakeId: intake.id,
          newBatteryModel: dto.newBatteryModel,
          newBatterySerial: dto.newBatterySerial,
        },
        include: { intake: true },
      });
      return { voucher, alreadyIssued: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const voucher = await this.prisma.voucher.findUnique({
          where: { intakeId: intake.id },
          include: { intake: true },
        });
        if (voucher) return { voucher, alreadyIssued: true };
      }
      throw e;
    }
  }

  findAll() {
    return this.prisma.voucher.findMany({ include: { intake: true }, orderBy: { issuedAt: 'desc' } });
  }

  async findOne(voucherNo: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { voucherNo }, include: { intake: true } });
    if (!voucher) throw new NotFoundException(`凭证 ${voucherNo} 不存在`);
    return voucher;
  }

  private async nextVoucherNo() {
    const count = await this.prisma.voucher.count();
    return `VCH-${String(count + 1).padStart(6, '0')}`;
  }
}
