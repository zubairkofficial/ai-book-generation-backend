"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const book_generation_service_1 = require("./book-generation.service");
describe('BookGenerationService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [book_generation_service_1.BookGenerationService],
        }).compile();
        service = module.get(book_generation_service_1.BookGenerationService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
//# sourceMappingURL=book-generation.service.spec.js.map