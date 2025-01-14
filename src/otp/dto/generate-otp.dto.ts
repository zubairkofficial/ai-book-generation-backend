// src/otp/dto/generate-otp.dto.ts
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address to send OTP' })
  @IsEmail()
  email: string;
}
