import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { CreateIntakeDto, ReweighDto } from './dto';

@Controller('intakes')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post()
  create(@Body() dto: CreateIntakeDto) {
    return this.intakeService.create(dto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.intakeService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.intakeService.findOne(id);
  }

  @Post(':id/reweigh')
  reweigh(@Param('id') id: string, @Body() dto: ReweighDto) {
    return this.intakeService.reweigh(id, dto);
  }
}
