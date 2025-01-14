// src/otp/dto/verify-otp.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address associated with the OTP' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'The OTP code to verify' })
  @IsString()
  code: string;
}
