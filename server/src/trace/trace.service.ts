import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TraceEvent {
  stage:
    | 'INTAKE'
    | 'REWEIGH'
    | 'RECEIPT_ISSUED'
    | 'DISPATCHED'
    | 'RECEIVED_BY_RECYCLER'
    | 'ACKNOWLEDGED';
  at: string;
  title: string;
  detail: string;
}

@Injectable()
export class TraceService {
  constructor(private readonly prisma: PrismaService) {}

  /** 沿旧件编号查看完整去向 */
  async trace(serial: string) {
    const battery = await this.prisma.oldBattery.findUnique({
      where: { serialNumber: serial },
      include: {
        weightRecords: { orderBy: { createdAt: 'asc' } },
        receipt: true,
        dispatchItem: {
          include: {
            batch: {
              include: {
                acknowledgment: true,
                items: { include: { battery: true } },
              },
            },
          },
        },
      },
    });
    if (!battery) {
      throw new NotFoundException(`未找到旧件编号 ${serial}`);
    }

    const events: TraceEvent[] = [];

    events.push({
      stage: 'INTAKE',
      at: battery.physicalVerifiedAt.toISOString(),
      title: '实物核实入库',
      detail: `重量 ${battery.weightKg} kg，车辆 ${battery.vehiclePlate}，经手人 ${battery.intakeOperator}`,
    });

    for (const w of battery.weightRecords) {
      events.push({
        stage: 'REWEIGH',
        at: w.createdAt.toISOString(),
        title: '复称',
        detail: `原重量 ${w.previousWeightKg} kg → 新测量 ${w.newWeightKg} kg（${w.operator}${w.reason ? `，${w.reason}` : ''}）`,
      });
    }

    if (battery.receipt) {
      const r = battery.receipt;
      events.push({
        stage: 'RECEIPT_ISSUED',
        at: r.issuedAt.toISOString(),
        title: '旧件回收凭证已开具',
        detail: `凭证号 ${r.receiptNo}；新装 ${r.newBatteryBrand}/${r.newBatteryModel}（${r.newBatterySerial}），旧件 ${r.oldBatterySerial} 记重 ${r.oldWeightKg} kg`,
      });
    }

    const batch = battery.dispatchItem?.batch;
    if (batch) {
      events.push({
        stage: 'DISPATCHED',
        at: batch.dispatchedAt.toISOString(),
        title: '发给回收商',
        detail: `批次 ${batch.batchNo}，回收商 ${batch.recyclerName}，发出 ${batch.shippedCount} 件`,
      });

      const ack = batch.acknowledgment;
      if (ack) {
        const serials: string[] = JSON.parse(ack.receivedSerials || '[]');
        const thisOneReceived =
          serials.length === 0 || serials.includes(battery.serialNumber);

        if (thisOneReceived) {
          events.push({
            stage: 'RECEIVED_BY_RECYCLER',
            at: ack.signedAt.toISOString(),
            title: '回收商确认收到本件',
            detail: `签收人 ${ack.signedBy}`,
          });
        } else {
          events.push({
            stage: 'RECEIVED_BY_RECYCLER',
            at: ack.signedAt.toISOString(),
            title: '回执未确认收到本件',
            detail: `本编号不在签收编号清单内，需逐件核实`,
          });
        }

        events.push({
          stage: 'ACKNOWLEDGED',
          at: ack.signedAt.toISOString(),
          title:
            batch.status === 'ACKNOWLEDGED'
              ? '签收回执：数量一致'
              : '签收回执：数量不符，待核实',
          detail:
            batch.status === 'ACKNOWLEDGED'
              ? `发出 ${batch.shippedCount} 件 / 实收 ${ack.receivedCount} 件`
              : `发出 ${batch.shippedCount} 件 / 实收 ${ack.receivedCount} 件，差额 ${batch.differenceCount} 件（保留原始数据，未改成一致）`,
        });
      } else {
        events.push({
          stage: 'ACKNOWLEDGED',
          at: batch.dispatchedAt.toISOString(),
          title: '已发出，等待回收商签收',
          detail: `批次 ${batch.batchNo}`,
        });
      }
    }

    return {
      serialNumber: battery.serialNumber,
      status: battery.status,
      currentWeightKg: battery.weightKg,
      vehiclePlate: battery.vehiclePlate,
      receiptIssued: !!battery.receipt,
      receiptNo: battery.receipt?.receiptNo ?? null,
      events: events.sort((a, b) => a.at.localeCompare(b.at)),
      batch: batch
        ? {
            batchNo: batch.batchNo,
            recyclerName: batch.recyclerName,
            status: batch.status,
            shippedCount: batch.shippedCount,
            receivedCount: batch.receivedCount,
            differenceCount: batch.differenceCount,
          }
        : null,
    };
  }
}
