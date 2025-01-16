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
var BookGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookGenerationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const openai_1 = require("@langchain/openai");
const prompts_1 = require("@langchain/core/prompts");
const config_1 = require("@nestjs/config");
const book_generation_entity_1 = require("./entities/book-generation.entity");
let BookGenerationService = BookGenerationService_1 = class BookGenerationService {
    constructor(configService, bookGenerationRepository) {
        this.configService = configService;
        this.bookGenerationRepository = bookGenerationRepository;
        this.logger = new common_1.Logger(BookGenerationService_1.name);
        this.model = new openai_1.OpenAI({
            openAIApiKey: this.configService.get('OPENAI_API_KEY'),
            temperature: 0.7,
            modelName: 'gpt-4',
        });
    }
    async generateAndSaveBook(userId, promptData) {
        try {
            const bookContent = await this.createBookContent(promptData);
            const book = this.bookGenerationRepository.create({
                userId,
                bookTitle: promptData.bookTitle,
                genre: promptData.genre,
                theme: promptData.theme,
                characters: promptData.characters,
                setting: promptData.setting,
                tone: promptData.tone,
                plotTwists: promptData.plotTwists,
                numberOfPages: promptData.numberOfPages,
                numberOfChapters: promptData.numberOfChapters,
                targetAudience: promptData.targetAudience,
                language: promptData.language,
                additionalContent: promptData.additionalContent,
                additionalData: { fullContent: bookContent },
            });
            const savedBook = await this.bookGenerationRepository.save(book);
            this.logger.log(`Book successfully generated and saved for user ${userId}`);
            return savedBook;
        }
        catch (error) {
            this.logger.error(`Error generating and saving book for user ${userId}: ${error.message}`, error.stack);
            throw new Error('Failed to generate and save the book. Please try again.');
        }
    }
    async createBookContent(promptData) {
        try {
            const outlinePromptTemplate = new prompts_1.PromptTemplate({
                template: `
          Create a detailed outline for a book titled "{bookTitle}" based on the following details:
          - Genre: {genre}
          - Theme: {theme}
          - Main Characters: {characters}
          - Setting: {setting}
          - Tone: {tone}
          - Plot Twists: {plotTwists}
          - Number of Pages: {numberOfPages}
          - Number of Chapters: {numberOfChapters}
          - Target Audience: {targetAudience}
          - Language: {language}
          - Additional Content: {additionalContent}

          The outline should include:
          - A preface and introduction (if requested)
          - Chapter titles and brief summaries for each chapter
          - A conclusion
        `,
                inputVariables: [
                    'bookTitle',
                    'genre',
                    'theme',
                    'characters',
                    'setting',
                    'tone',
                    'plotTwists',
                    'numberOfPages',
                    'numberOfChapters',
                    'targetAudience',
                    'language',
                    'additionalContent',
                ],
            });
            const formattedOutlinePrompt = await outlinePromptTemplate.format({
                bookTitle: promptData.bookTitle,
                genre: promptData.genre,
                theme: promptData.theme,
                characters: promptData.characters,
                setting: promptData.setting,
                tone: promptData.tone,
                plotTwists: promptData.plotTwists,
                numberOfPages: promptData.numberOfPages,
                numberOfChapters: promptData.numberOfChapters,
                targetAudience: promptData.targetAudience,
                language: promptData.language,
                additionalContent: promptData.additionalContent,
            });
            const bookOutline = await this.model.invoke(formattedOutlinePrompt);
            const chapterPromptTemplate = new prompts_1.PromptTemplate({
                template: `
          Write a full chapter for the book titled "{bookTitle}". The chapter should be based on the following details:
          - Chapter Title: {chapterTitle}
          - Chapter Summary: {chapterSummary}
          - Genre: {genre}
          - Theme: {theme}
          - Main Characters: {characters}
          - Setting: {setting}
          - Tone: {tone}
          - Plot Twists: {plotTwists}
          - Target Audience: {targetAudience}
          - Language: {language}

          Ensure the chapter:
          - Is well-written and engaging
          - Advances the plot and develops characters
          - Matches the tone and style of the book
        `,
                inputVariables: [
                    'bookTitle',
                    'chapterTitle',
                    'chapterSummary',
                    'genre',
                    'theme',
                    'characters',
                    'setting',
                    'tone',
                    'plotTwists',
                    'targetAudience',
                    'language',
                ],
            });
            const chapters = bookOutline.split('\n').filter(line => line.startsWith('Chapter'));
            let fullBookContent = bookOutline + '\n\n';
            for (const chapter of chapters) {
                const [chapterTitle, chapterSummary] = chapter.split(':').map(s => s.trim());
                const formattedChapterPrompt = await chapterPromptTemplate.format({
                    bookTitle: promptData.bookTitle,
                    chapterTitle,
                    chapterSummary,
                    genre: promptData.genre,
                    theme: promptData.theme,
                    characters: promptData.characters,
                    setting: promptData.setting,
                    tone: promptData.tone,
                    plotTwists: promptData.plotTwists,
                    targetAudience: promptData.targetAudience,
                    language: promptData.language,
                });
                const chapterContent = await this.model.invoke(formattedChapterPrompt);
                fullBookContent += `\n\n${chapterTitle}\n\n${chapterContent}`;
            }
            const conclusionPromptTemplate = new prompts_1.PromptTemplate({
                template: `
          Write a conclusion for the book titled "{bookTitle}". The conclusion should:
          - Wrap up the story
          - Resolve any remaining plot points
          - Provide a satisfying ending for the readers
        `,
                inputVariables: ['bookTitle'],
            });
            const formattedConclusionPrompt = await conclusionPromptTemplate.format({
                bookTitle: promptData.bookTitle,
            });
            const conclusionContent = await this.model.invoke(formattedConclusionPrompt);
            fullBookContent += `\n\nConclusion\n\n${conclusionContent}`;
            return fullBookContent;
        }
        catch (error) {
            this.logger.error(`Error generating book content: ${error.message}`, error.stack);
            throw new Error('Failed to generate book content. Please try again.');
        }
    }
};
exports.BookGenerationService = BookGenerationService;
exports.BookGenerationService = BookGenerationService = BookGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(book_generation_entity_1.BookGeneration)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], BookGenerationService);
//# sourceMappingURL=book-generation.service.js.map