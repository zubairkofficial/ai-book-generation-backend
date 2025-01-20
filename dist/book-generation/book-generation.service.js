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
            const bookOutline = await this.textModel.invoke(formattedOutlinePrompt);
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
            let fullBookContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${promptData.bookTitle}</title>
          <style>
            /* Modern and Professional Styling */
            body {
              font-family: 'Merriweather', serif;
              line-height: 1.8;
              margin: 0;
              padding: 0;
              background-color: #f8f9fa;
              color: #333;
            }
            .book-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              background-color: #fff;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              border-radius: 12px;
            }
            h1 {
              font-size: 2.8rem;
              font-weight: 700;
              text-align: center;
              margin-bottom: 30px;
              color: #2c3e50;
              font-family: 'Playfair Display', serif;
            }
            h2 {
              font-size: 2.2rem;
              font-weight: 700; /* Bold heading */
              margin-top: 50px;
              margin-bottom: 20px;
              color: #34495e;
              font-family: 'Playfair Display', serif;
            }
            h3 {
              font-size: 1.8rem;
              font-weight: 700; /* Bold heading */
              margin-top: 40px;
              margin-bottom: 15px;
              color: #34495e;
              font-family: 'Playfair Display', serif;
            }
            p {
              font-size: 1.1rem;
              margin-bottom: 25px;
              text-align: justify;
              color: #555;
            }
            .cover-image {
              width: 100%;
              max-width: 500px;
              display: block;
              margin: 0 auto 30px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            .chapter {
              margin-bottom: 50px;
            }
            .chapter p {
              text-indent: 2em;
            }
            .outline {
              background-color: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 40px;
            }
            .outline p {
              margin-bottom: 15px;
            }
            /* Responsive Design */
            @media (max-width: 768px) {
              h1 {
                font-size: 2.2rem;
              }
              h2 {
                font-size: 1.8rem;
              }
              h3 {
                font-size: 1.5rem;
              }
              .book-container {
                padding: 20px 10px;
              }
            }
          </style>
          <!-- Google Fonts for Professional Typography -->
          <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
        </head>
        <body>
          <div class="book-container">
            <h1>${promptData.bookTitle}</h1>
            ${promptData.advancedOptions?.coverImagePrompt ? `<img src="${await this.generateBookCover(promptData.advancedOptions.coverImagePrompt)}" alt="Book Cover" class="cover-image">` : ''}
            <div class="outline">
              <h2>Outline</h2>
              <p>${bookOutline.replace(/\n/g, '<br>')}</p>
            </div>
      `;
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
                const chapterContent = await this.textModel.invoke(formattedChapterPrompt);
                fullBookContent += `
          <div class="chapter">
            <h2>${chapterTitle}</h2>
            <p>${chapterContent.replace(/\n/g, '<br>')}</p>
          </div>
        `;
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
            const conclusionContent = await this.textModel.invoke(formattedConclusionPrompt);
            fullBookContent += `
              <div class="chapter">
                <h2>Conclusion</h2>
                <p>${conclusionContent.replace(/\n/g, '<br>')}</p>
              </div>
            </div>
          </body>
          </html>
        `;
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