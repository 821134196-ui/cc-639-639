import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './dto';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  create(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(dto);
  }

  @Get()
  findAll() {
    return this.shipmentService.findAll();
  }

  // 静态路由须声明在 :id 之前
  @Get('discrepancies')
  discrepancies() {
    return this.shipmentService.findDiscrepancies();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipmentService.findOne(id);
  }
}
