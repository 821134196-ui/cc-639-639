import { Controller, Get, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':serialNo')
  track(@Param('serialNo') serialNo: string) {
    return this.trackingService.track(serialNo);
  }
}
