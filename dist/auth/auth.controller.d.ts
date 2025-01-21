import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthService } from './services/auth.service';
import { SignUpDto, SignInDto, UpdatePasswordDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signUp(dto: SignUpDto): Promise<{
        message: string;
    }>;
    signIn(dto: SignInDto): Promise<{
        message: string;
    }>;
    verifyOtp(body: {
        email: string;
        otp: string;
    }): Promise<{
        user: import("../users/entities/user.entity").User;
        accessToken: string;
    }>;
    login(dto: SignInDto): Promise<{
        user: import("../users/entities/user.entity").User;
        accessToken: string;
    }>;
    resetPassword(dto: any): Promise<{
        message: string;
    }>;
    updatePassword(userId: string, dto: UpdatePasswordDto): Promise<{
        message: string;
    }>;
    changePassword(changePasswordDto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    enableTwoFactor(userId: string): Promise<{
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
    verifyEmail(token: string): Promise<{
        url: string;
    }>;
}
