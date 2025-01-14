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
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const cron_1 = require("cron");
const config_1 = require("@nestjs/config");
const otp_entity_1 = require("./entities/otp.entity");
const users_service_1 = require("./../users/users.service");
let OtpService = class OtpService {
    constructor(otpRepository, usersService, schedulerRegistry, configService) {
        this.otpRepository = otpRepository;
        this.usersService = usersService;
        this.schedulerRegistry = schedulerRegistry;
        this.configService = configService;
    }
    onModuleInit() {
        const cronExpression = this.configService.get('OTP_CRON_JOB') || '*/5 * * * *';
        const job = new cron_1.CronJob(cronExpression, async () => {
            await this.cleanUpExpiredOtps();
        });
        this.schedulerRegistry.addCronJob('cleanUpExpiredOtps', job);
        job.start();
        console.log(`Cron job registered with expression: ${cronExpression}`);
    }
    async generateOtp(email) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5);
        await this.usersService.findByEmail(email);
        const otp = this.otpRepository.create({ email, code, expiresAt });
        return await this.otpRepository.save(otp);
    }
    async verifyOtp(email, code) {
        const otp = await this.otpRepository.findOne({
            where: { email, code, isUsed: false },
        });
        if (!otp)
            return false;
        if (new Date() > otp.expiresAt)
            return false;
        otp.isUsed = true;
        await this.otpRepository.save(otp);
        return true;
    }
    async cleanUpExpiredOtps() {
        const now = new Date();
        await this.otpRepository.delete({
            expiresAt: (0, typeorm_2.LessThan)(now),
        });
        console.log('Expired OTPs cleaned up at:', now);
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(otp_entity_1.Otp)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        users_service_1.UsersService,
        schedule_1.SchedulerRegistry,
        config_1.ConfigService])
], OtpService);
//# sourceMappingURL=otp.service.js.map