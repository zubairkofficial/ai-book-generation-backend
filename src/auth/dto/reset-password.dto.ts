import { IsEmail, IsUrl, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'http://localhost:3000/api/v1/reset-password' })
  @IsUrl()
  @IsOptional()
  redirectUrl?: string;

}