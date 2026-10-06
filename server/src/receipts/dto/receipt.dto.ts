import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 开具旧件回收凭证：必须先有已核实实物的旧件入库记录 */
export class IssueReceiptDto {
  @IsString()
  @IsNotEmpty({ message: '旧件编号不能为空' })
  oldBatterySerial!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  vehiclePlate!: string;

  // —— 新装电瓶 ——
  @IsString()
  @IsNotEmpty({ message: '新装电瓶品牌不能为空' })
  newBatteryBrand!: string;

  @IsString()
  @IsNotEmpty({ message: '新装电瓶型号不能为空' })
  newBatteryModel!: string;

  @IsString()
  @IsNotEmpty({ message: '新装电瓶序列号不能为空' })
  newBatterySerial!: string;

  @IsString()
  @IsOptional()
  installedAt?: string; // ISO 字符串，缺省取当前时间

  @IsString()
  @IsNotEmpty()
  operator!: string;
}
