import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IssueReceiptDto } from './dto/receipt.dto';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 开具回收凭证。
   * 铁律：没有核实实物（无入库记录）不能开；一件旧件只能开一张凭证。
   */
  async issue(dto: IssueReceiptDto) {
    const serial = dto.oldBatterySerial.trim();
    const battery = await this.prisma.oldBattery.findUnique({
      where: { serialNumber: serial },
      include: { receipt: true },
    });

    // 无实物 / 未入库核实 → 拒绝
    if (!battery) {
      throw new BadRequestException(
        `旧件编号 ${serial} 没有实物核实与入库记录，不能开具回收凭证`,
      );
    }
    if (!battery.physicalVerifiedAt) {
      throw new BadRequestException(
        '旧件实物尚未核实，不能开具回收凭证',
      );
    }
    if (battery.receipt) {
      throw new ConflictException(
        `旧件编号 ${serial} 的回收凭证 ${battery.receipt.receiptNo} 已开具，不能重复开具`,
      );
    }

    const receiptNo = this.generateReceiptNo(battery.id);
    try {
      return await this.prisma.recyclingReceipt.create({
        data: {
          receiptNo,
          batteryId: battery.id,
          customerName: dto.customerName,
          vehiclePlate: dto.vehiclePlate,
          newBatteryBrand: dto.newBatteryBrand,
          newBatteryModel: dto.newBatteryModel,
          newBatterySerial: dto.newBatterySerial,
          installedAt: dto.installedAt ? new Date(dto.installedAt) : new Date(),
          // 旧件信息快照：后续复称不改变凭证
          oldBatterySerial: battery.serialNumber,
          oldWeightKg: battery.weightKg,
          operator: dto.operator,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('该旧件的回收凭证已存在，不能重复开具');
      }
      throw e;
    }
  }

  async findAll() {
    return this.prisma.recyclingReceipt.findMany({
      orderBy: { issuedAt: 'desc' },
      include: { battery: true },
    });
  }

  async findByReceiptNo(receiptNo: string) {
    const receipt = await this.prisma.recyclingReceipt.findUnique({
      where: { receiptNo },
      include: { battery: true },
    });
    if (!receipt) {
      throw new NotFoundException(`未找到凭证 ${receiptNo}`);
    }
    return receipt;
  }

  private generateReceiptNo(batteryId: number) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `HS-${y}${m}${d}-${String(batteryId).padStart(5, '0')}-${rand}`;
  }
}
