import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto } from './dto';

@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.voucherService.create(dto);
  }

  @Get()
  findAll() {
    return this.voucherService.findAll();
  }

  @Get(':voucherNo')
  findOne(@Param('voucherNo') voucherNo: string) {
    return this.voucherService.findOne(voucherNo);
  }
}
