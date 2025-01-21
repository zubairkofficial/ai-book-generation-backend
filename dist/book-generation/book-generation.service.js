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
const openai_2 = require("openai");
let BookGenerationService = BookGenerationService_1 = class BookGenerationService {
    constructor(configService, bookGenerationRepository) {
        this.configService = configService;
        this.bookGenerationRepository = bookGenerationRepository;
        this.logger = new common_1.Logger(BookGenerationService_1.name);
        this.textModel = new openai_1.OpenAI({
            openAIApiKey: this.configService.get('OPENAI_API_KEY'),
            temperature: 0.7,
            modelName: 'gpt-4',
        });
        this.openai = new openai_2.default({
            apiKey: this.configService.get('DALLE_API_KEY'),
        });
    }
    async generateAndSaveBook(userId, promptData) {
        try {
            const bookContent = await this.createBookContent(promptData);
            let coverImageUrl = null;
            if (promptData.advancedOptions?.coverImagePrompt) {
                coverImageUrl = await this.generateBookCover(promptData.advancedOptions.coverImagePrompt);
            }
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
                additionalData: { fullContent: bookContent, coverImageUrl },
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
    async getBooks(userId, promptData) {
        try {
            const bookContent = await this.createBookContent(promptData);
            let coverImageUrl = null;
            if (promptData.advancedOptions?.coverImagePrompt) {
                coverImageUrl = await this.generateBookCover(promptData.advancedOptions.coverImagePrompt);
            }
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
                additionalData: { fullContent: bookContent, coverImageUrl },
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
    async generateBookCover(prompt) {
        try {
            const response = await this.openai.images.generate({
                prompt: prompt,
                n: 1,
                size: '1024x1024',
            });
            return response.data[0].url;
        }
        catch (error) {
            this.logger.error(`Error generating book cover: ${error.message}`, error.stack);
            throw new Error('Failed to generate book cover. Please try again.');
        }
    }
    async createBookContent(promptData) {
        try {
            const outlinePromptTemplate = new prompts_1.PromptTemplate({
                template: `
          As a professional book editor, create a detailed outline for "{bookTitle}". Consider these specifications:
          
          BOOK SPECIFICATIONS:
          Genre: {genre}
          Theme: {theme}
          Target Audience: {targetAudience}
          Language: {language}
          Desired Length: {numberOfPages} pages, {numberOfChapters} chapters
          
          STORY ELEMENTS:
          Main Characters: {characters}
          Setting: {setting}
          Tone: {tone}
          Plot Twists: {plotTwists}
          Additional Elements: {additionalContent}
          
          Please provide:
          1. A compelling executive summary (2-3 paragraphs)
          2. Detailed chapter-by-chapter outline including:
             - Chapter titles
             - Chapter summaries (200-300 words each)
             - Key plot points and character development
             - Thematic elements to be explored
          3. Notes on story arc progression
          4. Key emotional beats and tension points
          
          Format the outline professionally and ensure it maintains narrative cohesion.
        `,
                inputVariables: [
                    'bookTitle', 'genre', 'theme', 'characters', 'setting', 'tone',
                    'plotTwists', 'numberOfPages', 'numberOfChapters', 'targetAudience',
                    'language', 'additionalContent'
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
            const bookOutline = await this.textModel.invoke(formattedOutlinePrompt);
            const chapterPromptTemplate = new prompts_1.PromptTemplate({
                template: `
          Write Chapter {chapterNumber} for "{bookTitle}" following these professional guidelines:

          CHAPTER CONTEXT:
          Title: {chapterTitle}
          Summary: {chapterSummary}
          
          STORY PARAMETERS:
          Genre: {genre}
          Theme: {theme}
          Characters: {characters}
          Setting: {setting}
          Tone: {tone}
          
          WRITING GUIDELINES:
          1. Begin with a strong hook that draws readers in
          2. Maintain consistent POV and tense throughout
          3. Balance dialogue, action, and description
          4. Include sensory details and vivid imagery
          5. End with a compelling hook for the next chapter
          6. Incorporate theme naturally without being heavy-handed
          7. Ensure proper pacing and scene transitions
          
          Target Audience: {targetAudience}
          Language Style: {language}
          
          Write this chapter maintaining professional literary standards and ensuring it advances both plot and character development.
        `,
                inputVariables: [
                    'chapterNumber', 'bookTitle', 'chapterTitle', 'chapterSummary',
                    'genre', 'theme', 'characters', 'setting', 'tone', 'plotTwists',
                    'targetAudience', 'language'
                ],
            });
            let fullBookContent = '';
            fullBookContent += `${promptData.bookTitle}\n\n`;
            const introductionPrompt = new prompts_1.PromptTemplate({
                template: `
          Write a compelling introduction for "{bookTitle}" that:
          1. Hooks the reader immediately
          2. Sets up the book's central premise
          3. Establishes the book's tone and style
          4. Provides necessary context without revealing too much
          5. Creates anticipation for what's to come
          
          Genre: {genre}
          Theme: {theme}
          Target Audience: {targetAudience}
        `,
                inputVariables: ['bookTitle', 'genre', 'theme', 'targetAudience']
            });
            const formattedIntroductionPrompt = await introductionPrompt.format({
                bookTitle: promptData.bookTitle,
                genre: promptData.genre,
                theme: promptData.theme,
                targetAudience: promptData.targetAudience,
            });
            const introductionContent = await this.textModel.invoke(formattedIntroductionPrompt);
            fullBookContent += `Introduction\n\n${introductionContent}\n\n`;
            const chapters = bookOutline.split('\n').filter(line => line.startsWith('Chapter'));
            for (const [index, chapter] of chapters.entries()) {
                const [chapterTitle, chapterSummary] = chapter.split(':').map(s => s.trim());
                const formattedChapterPrompt = await chapterPromptTemplate.format({
                    chapterNumber: index + 1,
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
                const chapterContent = await this.textModel.invoke(formattedChapterPrompt);
                fullBookContent += `\n\nChapter ${index + 1}: ${chapterTitle}\n\n${chapterContent}`;
            }
            const conclusionPrompt = new prompts_1.PromptTemplate({
                template: `
          Write a satisfying conclusion for "{bookTitle}" that:
          1. Resolves main conflicts and character arcs
          2. Ties together major themes
          3. Provides emotional closure
          4. Leaves readers fulfilled while maintaining intrigue
          5. Matches the tone and style of the book
          
          Genre: {genre}
          Theme: {theme}
          Target Audience: {targetAudience}
        `,
                inputVariables: ['bookTitle', 'genre', 'theme', 'targetAudience']
            });
            const formattedConclusionPrompt = await conclusionPrompt.format({
                bookTitle: promptData.bookTitle,
                genre: promptData.genre,
                theme: promptData.theme,
                targetAudience: promptData.targetAudience,
            });
            const conclusionContent = await this.textModel.invoke(formattedConclusionPrompt);
            fullBookContent += `\n\nConclusion\n\n${conclusionContent}`;
            return fullBookContent;
        }
        catch (error) {
            this.logger.error(`Error generating book content: ${error.message}`, error.stack);
            throw new Error('Failed to generate book content. Please try again.');
        }
    }
    async getAllBooksByUser(userId) {
        return await this.bookGenerationRepository.find({ where: { userId } });
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