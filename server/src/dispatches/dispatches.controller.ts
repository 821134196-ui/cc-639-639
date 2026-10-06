import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { DispatchesService } from './dispatches.service';
import { AcknowledgeDto, CreateDispatchDto } from './dto/dispatch.dto';

@Controller('api/dispatches')
export class DispatchesController {
  constructor(private readonly service: DispatchesService) {}

  /** 暂存旧件发给回收商 */
  @Post()
  create(@Body() dto: CreateDispatchDto) {
    return this.service.create(dto);
  }

  /** 回收商电子签收回执（本地模拟；重复签收只记一次） */
  @Post(':id/acknowledge')
  acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcknowledgeDto,
  ) {
    return this.service.acknowledge(id, dto);
  }

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
