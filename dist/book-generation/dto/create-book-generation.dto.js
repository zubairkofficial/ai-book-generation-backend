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
exports.BookGenerationDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
class BookGenerationDto {
}
exports.BookGenerationDto = BookGenerationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The title of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "bookTitle", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The genre of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "genre", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The theme of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "theme", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The main characters in the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "characters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The setting of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "setting", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The tone of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "tone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Plot twists in the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "plotTwists", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The number of pages in the book' }),
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], BookGenerationDto.prototype, "numberOfPages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The number of chapters in the book' }),
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], BookGenerationDto.prototype, "numberOfChapters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The target audience for the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "targetAudience", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The language of the book' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "language", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Additional content or notes for the book', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], BookGenerationDto.prototype, "additionalContent", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Advanced options for generating a book cover image', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], BookGenerationDto.prototype, "advancedOptions", void 0);
//# sourceMappingURL=create-book-generation.dto.js.map