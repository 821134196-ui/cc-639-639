import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** 暂存旧件发给回收商（建立发出批次） */
export class CreateDispatchDto {
  @IsString()
  @IsNotEmpty({ message: '回收商名称不能为空' })
  recyclerName!: string;

  @IsArray()
  @IsString({ each: true })
  serialNumbers!: string[];

  @IsString()
  @IsNotEmpty()
  operator!: string;

  @IsString()
  @IsOptional()
  note?: string;
}

/** 回收商电子签收回执（本地模拟） */
export class AcknowledgeDto {
  @IsInt()
  @Min(0, { message: '实收数量不能为负' })
  receivedCount!: number;

  /** 按编号确认收到的旧件；可空（仅报数量时也保留差额） */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  receivedSerials?: string[];

  @IsString()
  @IsNotEmpty({ message: '签收人不能为空' })
  signedBy!: string;

  /** 本地模拟电子签名（文本或手绘笔画数据） */
  @IsString()
  @IsNotEmpty({ message: '电子签名不能为空' })
  signatureData!: string;

  @IsString()
  @IsOptional()
  note?: string;
}
