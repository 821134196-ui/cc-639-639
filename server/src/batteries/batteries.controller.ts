import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BatteriesService } from './batteries.service';
import { IntakeBatteryDto, ReweighDto } from './dto/battery.dto';

@Controller('api/batteries')
export class BatteriesController {
  constructor(private readonly service: BatteriesService) {}

  /** 入库登记（必须核实实物） */
  @Post('intake')
  intake(@Body() dto: IntakeBatteryDto) {
    return this.service.intake(dto);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get(':serial')
  detail(@Param('serial') serial: string) {
    return this.service.findBySerial(serial);
  }

  /** 复称 */
  @Post(':serial/reweigh')
  reweigh(@Param('serial') serial: string, @Body() dto: ReweighDto) {
    return this.service.reweigh(serial, dto);
  }

  @Get(':serial/weights')
  weights(@Param('serial') serial: string) {
    return this.service.getWeightHistory(serial);
  }
}
