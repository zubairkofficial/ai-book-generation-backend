
import { ChangePasswordDto } from './dto/change-password.dto';

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpException,
  HttpStatus,
  BadRequestException,
  Query,
  Redirect,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './services/auth.service';
import {
  SignUpDto,
  SignInDto,
  ResetPasswordDto,
  UpdatePasswordDto,
} from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async signUp(@Body() dto: SignUpDto) {
    try {
      return await this.authService.signUp(dto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('signin')
  @ApiOperation({ summary: 'Generate OTP for login' })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  async signIn(@Body() dto: SignInDto) {
    try {
      return await this.authService.generateOtpForLogin(dto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and log in user' })
  @ApiResponse({ status: 200, description: 'OTP verified, user logged in' })
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    try {
      return await this.authService.verifyOtpAndLogin(body.email, body.otp);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Standard login without OTP' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  async login(@Body() dto: SignInDto) {
    try {
      return await this.authService.login(dto);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
    }
  }
  @Post('reset-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async resetPassword(@Body() dto) {
    try {
      // Pass both email and redirectUrl to forgotPassword
      return await this.authService.forgotPassword(dto.email.email, dto.redirectUrl);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  

  @Post('update-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update password' })
  @ApiResponse({ status: 200, description: 'Password successfully updated' })
  async updatePassword(
    @GetUser('id') userId: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    try {
      return await this.authService.updatePassword(userId, dto.newPassword);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('password-reset')
  @ApiOperation({ summary: 'Change Password using token' })
  @ApiResponse({ status: 200, description: 'Password successfully updated.' })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto) {
    return await this.authService.changePassword(
      changePasswordDto.token,
      changePasswordDto.newPassword,
    );
  }

  @Post('enable-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA successfully enabled' })
  async enableTwoFactor(@GetUser('id') userId: string) {
    try {
      return await this.authService.enableTwoFactor(+userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('verify-2fa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify two-factor authentication token' })
  @ApiResponse({ status: 200, description: '2FA token verified' })
  async verifyTwoFactor(
    @GetUser('id') userId: string,
    @Body('token') token: string,
  ) {
    try {
      return await this.authService.verifyTwoFactor(userId, token);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Access token refreshed' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    try {
      return await this.authService.refreshToken(refreshToken);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Improved Email Verification
   *
   * - Uses @Redirect to send the user to a success page if verification works
   * - If token is invalid or expired, you can catch the error and redirect to an error page
   * - You can also add additional checks, e.g. if user is already verified
   */
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend URL.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  @Redirect()
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    try {
      // The authService.verifyEmail(token) should return a success redirect URL
      // or throw an error if the token is invalid/expired.
      const successRedirectUrl = await this.authService.verifyEmail(token);

      return { url: successRedirectUrl };
    } catch (error) {
      // If token is invalid, you may want to redirect to a specific "email verification failed" page
      // so the user gets clearer feedback. Or, you could throw a BadRequestException:
      //
      // throw new BadRequestException(error.message);
      //
      // For a friendlier UX, we often prefer redirecting to a custom error page.
      return {
        url: `${process.env.FRONTEND_URL}/verification-failure?reason=` + encodeURIComponent(error.message),
      };
    }
  }
}
