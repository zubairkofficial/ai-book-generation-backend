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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const otp_service_1 = require("./otp.service");
const generate_otp_dto_1 = require("./dto/generate-otp.dto");
const verify_otp_dto_1 = require("./dto/verify-otp.dto");
let OtpController = class OtpController {
    constructor(otpService) {
        this.otpService = otpService;
    }
    async generateOtp(generateOtpDto) {
        const otp = await this.otpService.generateOtp(generateOtpDto.email);
        return { message: 'OTP generated successfully', otpId: otp.id };
    }
    async verifyOtp(verifyOtpDto) {
        const isValid = await this.otpService.verifyOtp(verifyOtpDto.email, verifyOtpDto.code);
        if (!isValid) {
            return { message: 'Invalid or expired OTP' };
        }
        return { message: 'OTP verified successfully' };
    }
};
exports.OtpController = OtpController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, common_1.HttpCode)(201),
    (0, swagger_1.ApiOperation)({ summary: 'Generate OTP' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'OTP generated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid email address' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [generate_otp_dto_1.GenerateOtpDto]),
    __metadata("design:returntype", Promise)
], OtpController.prototype, "generateOtp", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiOperation)({ summary: 'Verify OTP' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'OTP verified successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid or expired OTP' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", Promise)
], OtpController.prototype, "verifyOtp", null);
exports.OtpController = OtpController = __decorate([
    (0, swagger_1.ApiTags)('OTP'),
    (0, common_1.Controller)('otp'),
    __metadata("design:paramtypes", [otp_service_1.OtpService])
], OtpController);
//# sourceMappingURL=otp.controller.js.map