import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { IntakeModule } from './intake/intake.module';
import { VoucherModule } from './voucher/voucher.module';
import { ShipmentModule } from './shipment/shipment.module';
import { ReceiptModule } from './receipt/receipt.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [PrismaModule, IntakeModule, VoucherModule, ShipmentModule, ReceiptModule, TrackingModule],
})
export class AppModule {}
