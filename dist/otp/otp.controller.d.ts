import { OtpService } from './otp.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
export declare class OtpController {
    private readonly otpService;
    constructor(otpService: OtpService);
    generateOtp(generateOtpDto: GenerateOtpDto): Promise<{
        message: string;
        otpId: number;
    }>;
    verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
        message: string;
    }>;
}
