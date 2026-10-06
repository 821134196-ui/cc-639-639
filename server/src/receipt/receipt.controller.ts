import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { CreateReceiptDto } from './dto';

@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post()
  create(@Body() dto: CreateReceiptDto) {
    return this.receiptService.create(dto);
  }

  @Get(':receiptNo')
  findByNo(@Param('receiptNo') receiptNo: string) {
    return this.receiptService.findByNo(receiptNo);
  }
}
