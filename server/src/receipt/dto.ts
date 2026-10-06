import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class ReceiptItemInput {
  @IsString()
  @IsNotEmpty()
  serialNo: string; // 回收商实收的旧件编号

  @IsNumber()
  @Min(0)
  receivedWeightKg: number; // 实收重量
}

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  shipmentId: string;

  @IsString()
  @IsNotEmpty()
  receiptNo: string; // 回收商回执号；同一回执号只记一次

  @IsString()
  @IsNotEmpty()
  signerName: string; // 签收人（电子签收本地模拟）

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemInput)
  items: ReceiptItemInput[];
}
