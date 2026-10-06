import { IsNotEmpty, IsString } from 'class-validator';

export class CreateVoucherDto {
  @IsString()
  @IsNotEmpty()
  serialNo: string; // 回收旧件编号

  @IsString()
  @IsNotEmpty()
  newBatteryModel: string; // 新装电瓶型号

  @IsString()
  @IsNotEmpty()
  newBatterySerial: string; // 新装电瓶编号
}
