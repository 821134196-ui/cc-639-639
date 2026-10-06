import { Module } from '@nestjs/common';
import { BatteriesController } from './batteries.controller';
import { BatteriesService } from './batteries.service';

@Module({
  controllers: [BatteriesController],
  providers: [BatteriesService],
  exports: [BatteriesService],
})
export class BatteriesModule {}
