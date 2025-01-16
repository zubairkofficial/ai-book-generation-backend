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
var BookGenerationController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookGenerationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const book_generation_service_1 = require("./book-generation.service");
const create_book_generation_dto_1 = require("./dto/create-book-generation.dto");
const swagger_1 = require("@nestjs/swagger");
let BookGenerationController = BookGenerationController_1 = class BookGenerationController {
    constructor(bookGenerationService) {
        this.bookGenerationService = bookGenerationService;
        this.logger = new common_1.Logger(BookGenerationController_1.name);
    }
    async generateBook(bookGenerationDto, request) {
        const userId = request.user?.id;
        this.logger.log(`Generating book for user ID: ${userId}`);
        if (!userId) {
            this.logger.error('Unauthorized: User ID not found in the request.');
            throw new common_1.UnauthorizedException('Unauthorized: User ID not found in the request.');
        }
        try {
            const savedBook = await this.bookGenerationService.generateAndSaveBook(userId, bookGenerationDto);
            this.logger.log(`Book successfully generated and saved for user ID: ${userId}`);
            return {
                message: 'Book successfully generated and saved.',
                data: savedBook,
            };
        }
        catch (error) {
            this.logger.error(`Error generating and saving book for user ID: ${userId}`, error.stack);
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('An error occurred while generating and saving the book.');
        }
    }
};
exports.BookGenerationController = BookGenerationController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('generate'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate and save a book based on provided parameters' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'The book has been successfully generated and saved.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad Request.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    (0, swagger_1.ApiResponse)({ status: 500, description: 'Internal Server Error.' }),
    (0, swagger_1.ApiBody)({ type: create_book_generation_dto_1.BookGenerationDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_book_generation_dto_1.BookGenerationDto, Object]),
    __metadata("design:returntype", Promise)
], BookGenerationController.prototype, "generateBook", null);
exports.BookGenerationController = BookGenerationController = BookGenerationController_1 = __decorate([
    (0, swagger_1.ApiTags)('books'),
    (0, common_1.Controller)('book-generation'),
    __metadata("design:paramtypes", [book_generation_service_1.BookGenerationService])
], BookGenerationController);
//# sourceMappingURL=book-generation.controller.js.map