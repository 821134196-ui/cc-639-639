import { Controller, Get, Param } from '@nestjs/common';
import { TraceService } from './trace.service';

@Controller('api/trace')
export class TraceController {
  constructor(private readonly service: TraceService) {}

  /** 车主 / 门店沿旧件编号查看去向 */
  @Get(':serial')
  trace(@Param('serial') serial: string) {
    return this.service.trace(serial);
  }
}
