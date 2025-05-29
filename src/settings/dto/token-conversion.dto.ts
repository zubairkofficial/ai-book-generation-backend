import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TokenConversionDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  creditsPerModelToken: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  creditsPerImageToken: number;
} 