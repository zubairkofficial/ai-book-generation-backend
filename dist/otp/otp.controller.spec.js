"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const otp_controller_1 = require("./otp.controller");
describe('OtpController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [otp_controller_1.OtpController],
        }).compile();
        controller = module.get(otp_controller_1.OtpController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
//# sourceMappingURL=otp.controller.spec.js.map