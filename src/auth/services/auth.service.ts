import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { EmailService } from './email.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { UsersService } from 'src/users/users.service';
import { SignInDto, SignUpDto } from '../dto';
import { CryptoService } from 'src/utils/crypto.service';
import { OtpService } from 'src/otp/otp.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,

    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly cryptoService: CryptoService, // Inject CryptoService
    private readonly configService: ConfigService, // Inject ConfigService
  ) {}

  async signUp(signUpDto: SignUpDto) {
    try {
      const { name, email, password } = signUpDto;

      // Hash the password using CryptoService
      const hashedPassword = await this.cryptoService.encrypt(password);

      // Create the user
      const user = await this.usersService.create({
        name,
        email,
        password: hashedPassword,
      });

      // Send email verification
      const token = this.jwtService.sign({ email });
      const baseUrl = this.configService.get<string>('BASE_URL'); // Get base URL from environment
      const verifyLink = `${baseUrl}/auth/verify-email?token=${token}`;
      await this.emailService.sendVerificationEmail(user, verifyLink);

      return { message: 'User registered successfully. Please check your email for verification.' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  // starts 
  // Step 1: Generate OTP for Login Attempt
  async generateOtpForLogin(signInDto: SignInDto) {
    const { email, password } = signInDto;
  
    // Verify if the user exists
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
  
    // Verify the password
    const isPasswordValid = await this.cryptoService.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
  
    // Generate OTP
    const otp = await this.otpService.generateOtp(email);
  
    // Send OTP via email
    // await this.emailService.sendOtpEmail(email, otp.code);
  
    return { message: 'OTP sent to your email. Please verify to log in.' };
  }
  

  // Step 2: Verify OTP and Log In
  async verifyOtpAndLogin(email: string, otpCode: string) {
    // Verify OTP
    const isOtpValid = await this.otpService.verifyOtp(email, otpCode);

    if (!isOtpValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Fetch the user
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
const oneDay=this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN')
    // Generate tokens
    const payload = { email: user.email, id: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: oneDay,
    });
   

    return { user, accessToken };
  }

  // Standard Login without OTP
  async login(loginDto: SignInDto) {
    const { email, password } = loginDto;

    // Check if the user exists
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email before logging in.');
    }

    // Verify password
    const isPasswordValid = await this.cryptoService.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    const payload = { email: user.email, id: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN'),
    });
   

    return { user, accessToken };
  }

 
  // end


  async forgotPassword(email: string, redirectUrl?: string) {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate a password reset token
      const resetToken = this.jwtService.sign(
        { email },
        { expiresIn: '1h' }, // 1 hour, for example
      );

      // Fallback base URL (from environment)
      const baseUrl = this.configService.get<string>('FRONTEND_URL');

      // If redirectUrl is provided, append the token there.
      // Otherwise, use our own /auth/reset-password route.
      // Typically, your frontend might have a route like:
      //   http://frontend.com/reset-password?token=...
      const resetLink = redirectUrl
        ? `${redirectUrl}?token=${resetToken}`
        : `${baseUrl}/auth/password-reset?token=${resetToken}`;

      // Send the reset link to the user's email
      await this.emailService.sendPasswordResetEmail(user, resetLink);

      return { message: 'Password reset email sent. Check your inbox.' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * STEP 2 – RESET PASSWORD
   * 1. Verify the token
   * 2. Find user by email from token
   * 3. Hash the new password
   * 4. Update user's password
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      // Verify the token using JWT
      const { email } = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Find user by email
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('Invalid token');
      }

      // Hash the new password
      const hashedPassword = await this.cryptoService.encrypt(newPassword);

      // Update the user's password
      await this.usersService.updatePassword(user.id, hashedPassword);

      return { message: 'Password reset successfully.' };
    } catch (error) {
      throw new BadRequestException('Invalid or expired token');
    }
  }


  async updatePassword(userId: string, newPassword: string) {
    try {
      // Hash the new password using CryptoService
      const hashedPassword = await this.cryptoService.encrypt(newPassword);

      // Update the user's password
      await this.usersService.updatePassword(+userId, hashedPassword);

      return { message: 'Password updated successfully.' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  async changePassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      // Decode and verify the JWT token
      const { email } = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET, // Ensure consistency in your environment
      });
  
      // Find the user by email
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('Invalid or expired token.');
      }
  
      // Hash the new password
      const hashedPassword = await this.cryptoService.encrypt(newPassword);
  
      // Update the user's password
      await this.usersService.updatePassword(user.id, hashedPassword);
  
      return { message: 'Password change successfully.' };
    } catch (error) {
      throw new BadRequestException('Invalid or expired token.');
    }
  }
  
  async verifyEmail(token: string): Promise<string> {
    try {
      // Verify the token using the JWT secret from the environment
      const { email } = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
  
      // Find the user by email
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new BadRequestException('Invalid token');
      }
  
      // Mark the user as verified
      await this.usersService.markEmailAsVerified(+user.id);
  
      // Return the frontend URL for redirection
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      return `${frontendUrl}`; // Redirect to a success page
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
  
  async enableTwoFactor(userId: number) {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Generate a secret for 2FA
      const secret = speakeasy.generateSecret({ name: `MyApp:${user.email}` });

      // Save the secret to the user's record
      await this.usersService.update(+userId, { twoFactorSecret: secret.base32 });

      // Generate a QR code for the user to scan
      const otpauthUrl = secret.otpauth_url;
      const qrCode = await QRCode.toDataURL(otpauthUrl);

      return { secret: secret.base32, qrCode };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async verifyTwoFactor(userId: string, token: string) {
    try {
      const user = await this.usersService.findById(+userId);
      if (!user || !user.twoFactorSecret) {
        throw new BadRequestException('2FA not enabled');
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
      });

      if (!verified) {
        throw new BadRequestException('Invalid 2FA token');
      }

      return { message: '2FA token verified successfully' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.id);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.generateTokens({ email: user.email, id: user.id, name: user.name }); // Include user info
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }
}