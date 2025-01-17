"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const email_service_1 = require("./email.service");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const users_service_1 = require("../../users/users.service");
const crypto_service_1 = require("../../utils/crypto.service");
const otp_service_1 = require("../../otp/otp.service");
let AuthService = class AuthService {
    constructor(usersService, otpService, jwtService, emailService, cryptoService, configService) {
        this.usersService = usersService;
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.cryptoService = cryptoService;
        this.configService = configService;
    }
    async signUp(signUpDto) {
        try {
            const { name, email, password } = signUpDto;
            const hashedPassword = await this.cryptoService.encrypt(password);
            const user = await this.usersService.create({
                name,
                email,
                password: hashedPassword,
            });
            const token = this.jwtService.sign({ email });
            const baseUrl = this.configService.get('BASE_URL');
            const verifyLink = `${baseUrl}/auth/verify-email?token=${token}`;
            await this.emailService.sendVerificationEmail(user, verifyLink);
            return { message: 'User registered successfully. Please check your email for verification.' };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async generateOtpForLogin(signInDto) {
        const { email, password } = signInDto;
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const isPasswordValid = await this.cryptoService.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const otp = await this.otpService.generateOtp(email);
        await this.emailService.sendOtpEmail(email, otp.code);
        return { message: 'OTP sent to your email. Please verify to log in.' };
    }
    async verifyOtpAndLogin(email, otpCode) {
        const isOtpValid = await this.otpService.verifyOtp(email, otpCode);
        if (!isOtpValid) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const oneDay = this.configService.get('ACCESS_TOKEN_EXPIRES_IN');
        const payload = { email: user.email, sub: user.id, name: user.name };
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: oneDay,
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
        });
        return { user, accessToken, refreshToken };
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isEmailVerified) {
            throw new common_1.ForbiddenException('Please verify your email before logging in.');
        }
        const isPasswordValid = await this.cryptoService.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { email: user.email, sub: user.id, name: user.name };
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRES_IN'),
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
        });
        return { user, accessToken, refreshToken };
    }
    async forgotPassword(email, redirectUrl) {
        try {
            const user = await this.usersService.findByEmail(email);
            if (!user) {
                throw new common_1.BadRequestException('User not found');
            }
            const resetToken = this.jwtService.sign({ email }, { expiresIn: '1h' });
            const baseUrl = this.configService.get('FRONTEND_URL');
            const resetLink = redirectUrl
                ? `${redirectUrl}?token=${resetToken}`
                : `${baseUrl}/auth/password-reset?token=${resetToken}`;
            await this.emailService.sendPasswordResetEmail(user, resetLink);
            return { message: 'Password reset email sent. Check your inbox.' };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async resetPassword(token, newPassword) {
        try {
            const { email } = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            const user = await this.usersService.findByEmail(email);
            if (!user) {
                throw new common_1.BadRequestException('Invalid token');
            }
            const hashedPassword = await this.cryptoService.encrypt(newPassword);
            await this.usersService.updatePassword(user.id, hashedPassword);
            return { message: 'Password reset successfully.' };
        }
        catch (error) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
    }
    async updatePassword(userId, newPassword) {
        try {
            const hashedPassword = await this.cryptoService.encrypt(newPassword);
            await this.usersService.updatePassword(+userId, hashedPassword);
            return { message: 'Password updated successfully.' };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async changePassword(token, newPassword) {
        try {
            const { email } = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET,
            });
            const user = await this.usersService.findByEmail(email);
            if (!user) {
                throw new common_1.BadRequestException('Invalid or expired token.');
            }
            const hashedPassword = await this.cryptoService.encrypt(newPassword);
            await this.usersService.updatePassword(user.id, hashedPassword);
            return { message: 'Password change successfully.' };
        }
        catch (error) {
            throw new common_1.BadRequestException('Invalid or expired token.');
        }
    }
    async verifyEmail(token) {
        try {
            const { email } = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            const user = await this.usersService.findByEmail(email);
            if (!user) {
                throw new common_1.BadRequestException('Invalid token');
            }
            await this.usersService.markEmailAsVerified(+user.id);
            const frontendUrl = this.configService.get('FRONTEND_URL');
            return `${frontendUrl}`;
        }
        catch (error) {
            throw new common_1.UnauthorizedException(error.message);
        }
    }
    async enableTwoFactor(userId) {
        try {
            const user = await this.usersService.findById(userId);
            if (!user) {
                throw new common_1.BadRequestException('User not found');
            }
            const secret = speakeasy.generateSecret({ name: `MyApp:${user.email}` });
            await this.usersService.update(+userId, { twoFactorSecret: secret.base32 });
            const otpauthUrl = secret.otpauth_url;
            const qrCode = await QRCode.toDataURL(otpauthUrl);
            return { secret: secret.base32, qrCode };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async verifyTwoFactor(userId, token) {
        try {
            const user = await this.usersService.findById(+userId);
            if (!user || !user.twoFactorSecret) {
                throw new common_1.BadRequestException('2FA not enabled');
            }
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token,
            });
            if (!verified) {
                throw new common_1.BadRequestException('Invalid 2FA token');
            }
            return { message: '2FA token verified successfully' };
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message);
        }
    }
    async refreshToken(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken);
            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            return this.generateTokens({ email: user.email, sub: user.id, name: user.name });
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
    }
    generateTokens(payload) {
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRES_IN'),
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
        });
        return { accessToken, refreshToken };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        otp_service_1.OtpService,
        jwt_1.JwtService,
        email_service_1.EmailService,
        crypto_service_1.CryptoService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map