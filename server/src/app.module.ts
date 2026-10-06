import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BatteriesModule } from './batteries/batteries.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { DispatchesModule } from './dispatches/dispatches.module';
import { TraceModule } from './trace/trace.module';

@Module({
  imports: [
    PrismaModule,
    BatteriesModule,
    ReceiptsModule,
    DispatchesModule,
    TraceModule,
  ],
})
export class AppModule {}
