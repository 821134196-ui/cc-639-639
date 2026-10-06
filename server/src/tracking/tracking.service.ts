import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  // 沿旧件编号查看完整去向：入库 → 复称 → 凭证 → 发货 → 回收商实收
  async track(serialNo: string) {
    const intake = await this.prisma.intake.findUnique({
      where: { serialNo },
      include: {
        voucher: true,
        shipmentItem: { include: { shipment: true } },
        receiptItem: { include: { receipt: true } },
        weighings: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!intake) throw new NotFoundException(`旧件编号 ${serialNo} 不存在`);

    const timeline: any[] = [];
    timeline.push({
      stage: 'INTAKE',
      title: '旧件入库（实物已核实）',
      at: intake.createdAt,
      detail: `登记重量 ${intake.initialWeightKg.toFixed(1)} kg，车辆 ${intake.vehiclePlate}，车主 ${intake.ownerName}`,
    });
    for (const w of intake.weighings) {
      timeline.push({
        stage: 'REWEIGH',
        title: '复称',
        at: w.createdAt,
        detail: `原重量 ${w.originalWeightKg.toFixed(1)} kg → 新测量 ${w.newWeightKg.toFixed(1)} kg${w.reason ? `（${w.reason}）` : ''}`,
      });
    }
    if (intake.voucher) {
      timeline.push({
        stage: 'VOUCHER',
        title: '开具回收凭证',
        at: intake.voucher.issuedAt,
        detail: `凭证号 ${intake.voucher.voucherNo}；新装电瓶 ${intake.voucher.newBatteryModel}（编号 ${intake.voucher.newBatterySerial}）`,
      });
    }
    if (intake.shipmentItem) {
      const si = intake.shipmentItem;
      timeline.push({
        stage: 'SHIP',
        title: `发往回收商：${si.shipment.recyclerName}`,
        at: si.shipment.shippedAt,
        detail: `批次 ${si.shipment.shipmentNo}，发出重量 ${si.sentWeightKg.toFixed(1)} kg`,
      });
    }
    if (intake.receiptItem) {
      const ri = intake.receiptItem;
      const sent = intake.shipmentItem ? intake.shipmentItem.sentWeightKg : null;
      const diffKg =
        ri.receivedWeightKg != null && sent != null ? Math.round((ri.receivedWeightKg - sent) * 1000) / 1000 : null;
      const titles: Record<string, string> = {
        MATCHED: '回收商实收确认（与发出相符）',
        MISMATCH: '回收商实收与发出不符（待核实）',
        MISSING: '回收商回执未包含该旧件（待核实）',
      };
      timeline.push({
        stage: 'RECEIPT',
        title: titles[ri.matchStatus] ?? ri.matchStatus,
        at: ri.receipt.receivedAt,
        detail: `回执号 ${ri.receipt.receiptNo}，签收人 ${ri.receipt.signerName}，电子签名 ${ri.receipt.signatureData}`,
        matchStatus: ri.matchStatus,
        sentWeightKg: sent,
        receivedWeightKg: ri.receivedWeightKg,
        diffKg,
      });
    }
    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const { voucher, shipmentItem, receiptItem, weighings, ...intakeData } = intake;
    return { intake: { ...intakeData, weighings }, voucher, shipmentItem, receiptItem, timeline };
  }
}
