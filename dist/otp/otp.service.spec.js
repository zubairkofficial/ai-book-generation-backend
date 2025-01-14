"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const otp_service_1 = require("./otp.service");
describe('OtpService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [otp_service_1.OtpService],
        }).compile();
        service = module.get(otp_service_1.OtpService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=otp.service.spec.js.map