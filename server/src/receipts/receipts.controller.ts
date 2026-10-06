import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { IssueReceiptDto } from './dto/receipt.dto';

@Controller('api/receipts')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  /** 开具旧件回收凭证（无实物入库记录拒绝） */
  @Post()
  issue(@Body() dto: IssueReceiptDto) {
    return this.service.issue(dto);
  }

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':receiptNo')
  detail(@Param('receiptNo') receiptNo: string) {
    return this.service.findByReceiptNo(receiptNo);
  }
}
