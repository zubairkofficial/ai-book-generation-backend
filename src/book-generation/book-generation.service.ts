import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { ConfigService } from '@nestjs/config';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { BookGeneration } from './entities/book-generation.entity';

@Injectable()
export class BookGenerationService {
  private model: OpenAI;
  private readonly logger = new Logger(BookGenerationService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>
  ) {
    this.model = new OpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      temperature: 0.7,
      modelName: 'gpt-4',
    });
  }

  async generateAndSaveBook(userId: number, promptData: BookGenerationDto): Promise<BookGeneration> {
    try {
      // Generate the book content
      const bookContent = await this.createBookContent(promptData);

      // Save the generated book into the database
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
    } catch (error) {
      this.logger.error(`Error generating and saving book for user ${userId}: ${error.message}`, error.stack);
      throw new Error('Failed to generate and save the book. Please try again.');
    }
  }

  private async createBookContent(promptData: BookGenerationDto): Promise<string> {
    try {
      // Step 1: Generate the book outline
      const outlinePromptTemplate = new PromptTemplate({
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

      // Step 2: Generate each chapter based on the outline
      const chapterPromptTemplate = new PromptTemplate({
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

      // Parse the outline to extract chapter titles and summaries
      const chapters = bookOutline.split('\n').filter(line => line.startsWith('Chapter')); // Adjust based on the outline format
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

      // Step 3: Generate the conclusion
      const conclusionPromptTemplate = new PromptTemplate({
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
    } catch (error) {
      this.logger.error(`Error generating book content: ${error.message}`, error.stack);
      throw new Error('Failed to generate book content. Please try again.');
    }
  }
}