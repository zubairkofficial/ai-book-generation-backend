"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const book_generation_controller_1 = require("./book-generation.controller");
const book_generation_service_1 = require("./book-generation.service");
describe('BookGenerationController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [book_generation_controller_1.BookGenerationController],
            providers: [book_generation_service_1.BookGenerationService],
        }).compile();
        controller = module.get(book_generation_controller_1.BookGenerationController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
//# sourceMappingURL=book-generation.controller.spec.js.map