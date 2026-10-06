import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  recyclerName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serialNos: string[]; // 本次发出的旧件编号
}
