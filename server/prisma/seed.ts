import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function sig(receiptNo: string, signer: string, shipmentId: string) {
  return (
    'SIG-' +
    createHash('sha256').update(`${receiptNo}|${signer}|${shipmentId}`).digest('hex').slice(0, 16).toUpperCase()
  );
}

async function main() {
  if ((await prisma.intake.count()) > 0) {
    console.log('[seed] 数据库已有数据，跳过种子数据。');
    return;
  }

  // 1) 完整链路：入库 → 凭证 → 发货 → 回收商实收相符
  const i1 = await prisma.intake.create({
    data: {
      serialNo: 'BAT-2026-0001',
      vehiclePlate: '沪A·D12345',
      ownerName: '王建国',
      ownerPhone: '13800002201',
      physicalVerified: true,
      initialWeightKg: 18.2,
      currentWeightKg: 18.2,
      status: 'RECEIVED',
    },
  });
  // 2) 已发出，回收商实收重量不符 → 待核实（差额保留）
  const i2 = await prisma.intake.create({
    data: {
      serialNo: 'BAT-2026-0002',
      vehiclePlate: '沪B·T88990',
      ownerName: '李秀兰',
      ownerPhone: '13900005502',
      physicalVerified: true,
      initialWeightKg: 17.6,
      currentWeightKg: 17.6,
      status: 'DISPUTED',
    },
  });
  // 3) 暂存中，已开凭证，有复称记录
  const i3 = await prisma.intake.create({
    data: {
      serialNo: 'BAT-2026-0003',
      vehiclePlate: '苏E·K33321',
      ownerName: '陈立',
      ownerPhone: '13700008803',
      physicalVerified: true,
      initialWeightKg: 16.9,
      currentWeightKg: 17.2,
      status: 'STORED',
    },
  });
  await prisma.weighing.create({
    data: { intakeId: i3.id, originalWeightKg: 16.9, newWeightKg: 17.2, reason: '入库秤校准后复称' },
  });
  // 4) 暂存中，未开凭证（演示开凭证流程）
  const i4 = await prisma.intake.create({
    data: {
      serialNo: 'BAT-2026-0004',
      vehiclePlate: '浙A·P55667',
      ownerName: '赵敏',
      ownerPhone: '13600001104',
      physicalVerified: true,
      initialWeightKg: 19.3,
      currentWeightKg: 19.3,
      status: 'STORED',
    },
  });

  await prisma.voucher.create({
    data: { voucherNo: 'VCH-000001', intakeId: i1.id, newBatteryModel: '骆驼 6-QW-60', newBatterySerial: 'NB-2026-5501' },
  });
  await prisma.voucher.create({
    data: { voucherNo: 'VCH-000002', intakeId: i2.id, newBatteryModel: '瓦尔塔 H5-60', newBatterySerial: 'NB-2026-5502' },
  });
  await prisma.voucher.create({
    data: { voucherNo: 'VCH-000003', intakeId: i3.id, newBatteryModel: '风帆 55D23L', newBatterySerial: 'NB-2026-5503' },
  });

  const shipment = await prisma.shipment.create({
    data: {
      shipmentNo: 'SHP-0001',
      recyclerName: '绿源再生资源回收',
      status: 'PENDING_VERIFICATION',
      items: {
        create: [
          { intakeId: i1.id, sentWeightKg: 18.2 },
          { intakeId: i2.id, sentWeightKg: 17.6 },
        ],
      },
    },
  });

  const receipt = await prisma.receipt.create({
    data: {
      receiptNo: 'RCPT-2026-0901',
      shipmentId: shipment.id,
      signerName: '刘签收',
      signatureData: sig('RCPT-2026-0901', '刘签收', shipment.id),
    },
  });
  await prisma.receiptItem.create({
    data: { receiptId: receipt.id, intakeId: i1.id, receivedWeightKg: 18.2, matchStatus: 'MATCHED' },
  });
  await prisma.receiptItem.create({
    data: { receiptId: receipt.id, intakeId: i2.id, receivedWeightKg: 16.4, matchStatus: 'MISMATCH' },
  });

  console.log('[seed] 完成：4 件旧件、3 张凭证、1 个发货批次（含 1 件实收不符待核实）。');
  console.log('[seed] 可追踪编号：BAT-2026-0001（已实收）/ BAT-2026-0002（待核实）/ BAT-2026-0003、BAT-2026-0004（暂存）');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
