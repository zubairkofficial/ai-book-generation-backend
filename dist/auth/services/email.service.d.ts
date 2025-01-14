import { ConfigService } from '@nestjs/config';
import { User } from 'src/users/entities/user.entity';
export declare class EmailService {
    private readonly configService;
    private transporter;
    constructor(configService: ConfigService);
    sendOtpEmail(email: string, otp: string): Promise<void>;
    sendVerificationEmail(user: User, verifyLink: string): Promise<void>;
    sendPasswordResetEmail(user: User, resetLink: string): Promise<void>;
    private sendEmail;
}
