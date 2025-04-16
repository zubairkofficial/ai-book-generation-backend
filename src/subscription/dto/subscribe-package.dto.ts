import { IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribePackageDto {
  @ApiProperty({ description: 'Package ID to subscribe to' })
  @IsNumber()
  packageId: number;

  @ApiProperty({ description: 'Whether to cancel existing subscription' })
  @IsBoolean()
  @IsOptional()
  cancelExisting?: boolean;

  @ApiProperty({ description: 'Whether to auto-renew subscription' })
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  
} 