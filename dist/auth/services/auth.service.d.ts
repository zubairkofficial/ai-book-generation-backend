import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { UsersService } from 'src/users/users.service';
import { SignInDto, SignUpDto } from '../dto';
import { CryptoService } from 'src/utils/crypto.service';
import { OtpService } from 'src/otp/otp.service';
export declare class AuthService {
    private readonly usersService;
    private readonly otpService;
    private readonly jwtService;
    private readonly emailService;
    private readonly cryptoService;
    private readonly configService;
    constructor(usersService: UsersService, otpService: OtpService, jwtService: JwtService, emailService: EmailService, cryptoService: CryptoService, configService: ConfigService);
    signUp(signUpDto: SignUpDto): Promise<{
        message: string;
    }>;
    generateOtpForLogin(signInDto: SignInDto): Promise<{
        message: string;
    }>;
    verifyOtpAndLogin(email: string, otpCode: string): Promise<{
        user: import("../../users/entities/user.entity").User;
        accessToken: string;
    }>;
    login(loginDto: SignInDto): Promise<{
        user: import("../../users/entities/user.entity").User;
        accessToken: string;
    }>;
    forgotPassword(email: string, redirectUrl?: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    updatePassword(userId: string, newPassword: string): Promise<{
        message: string;
    }>;
    changePassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<string>;
    enableTwoFactor(userId: number): Promise<{
        secret: string;
        qrCode: string;
    }>;
    verifyTwoFactor(userId: string, token: string): Promise<{
        message: string;
    }>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private generateTokens;
}
