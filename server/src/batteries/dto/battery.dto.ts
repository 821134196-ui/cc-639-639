import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** 入库登记：必须核实旧件实物 */
export class IntakeBatteryDto {
  @IsString()
  @IsNotEmpty({ message: '旧件编号不能为空' })
  @MaxLength(64)
  serialNumber!: string;

  @IsString()
  @IsNotEmpty({ message: '车牌号不能为空' })
  vehiclePlate!: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: '重量必须大于 0' })
  weightKg!: number;

  @IsString()
  @IsNotEmpty({ message: '登记操作员不能为空' })
  intakeOperator!: string;

  @IsString()
  @IsOptional()
  intakeNote?: string;

  /** 必须显式确认已核实旧件实物，否则拒绝入库 */
  @IsBoolean()
  physicalVerified!: boolean;
}

/** 复称：保留原重量，记录新测量值 */
export class ReweighDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: '新重量必须大于 0' })
  newWeightKg!: number;

  @IsString()
  @IsNotEmpty()
  operator!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
