import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateIntakeDto {
  @IsString()
  @IsNotEmpty()
  serialNo: string;

  @IsString()
  @IsNotEmpty()
  vehiclePlate: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsNumber()
  @Min(0.1)
  weightKg: number;

  // 必须显式确认已核实实物；false 会被拒绝
  @IsBoolean()
  physicalVerified: boolean;
}

export class ReweighDto {
  @IsNumber()
  @Min(0.1)
  newWeightKg: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
