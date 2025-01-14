// src/otp/otp.controller.ts
import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('OTP') // Group for Swagger
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @HttpCode(201)
  @ApiOperation({ summary: 'Generate OTP' })
  @ApiResponse({ status: 201, description: 'OTP generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  async generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    const otp = await this.otpService.generateOtp(generateOtpDto.email);
    return { message: 'OTP generated successfully', otpId: otp.id };
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const isValid = await this.otpService.verifyOtp(
      verifyOtpDto.email,
      verifyOtpDto.code,
    );
    if (!isValid) {
      return { message: 'Invalid or expired OTP' };
    }
    return { message: 'OTP verified successfully' };
  }
}
