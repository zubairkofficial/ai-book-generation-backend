import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAI as LangchainOpenAI } from "@langchain/openai"; // For text generation
import { PromptTemplate } from "@langchain/core/prompts";
import { ConfigService } from '@nestjs/config';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { BookGeneration } from './entities/book-generation.entity';
import OpenAI from 'openai'; // For DALL·E image generation

@Injectable()
export class BookGenerationService {
  private textModel: LangchainOpenAI; // For text generation
  private openai: OpenAI; // For DALL·E image generation
  private readonly logger = new Logger(BookGenerationService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>
  ) {
    // Initialize OpenAI for text generation
    this.textModel = new LangchainOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      temperature: 0.7,
      modelName: 'gpt-4',
    });

    // Initialize OpenAI for DALL·E
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('DALLE_API_KEY'),
    });
  }

  async generateAndSaveBook(userId: number, promptData: BookGenerationDto): Promise<BookGeneration> {
    try {
      // Generate the book content
      const bookContent = await this.createBookContent(promptData);

      // Generate the book cover image if advanced options are provided
      let coverImageUrl: string | null = null;
      if (promptData.advancedOptions?.coverImagePrompt) {
        coverImageUrl = await this.generateBookCover(promptData.advancedOptions.coverImagePrompt);
      }

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
        additionalData: { fullContent: bookContent, coverImageUrl },
      });

      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(`Book successfully generated and saved for user ${userId}`);
      return savedBook;
    } catch (error) {
      this.logger.error(`Error generating and saving book for user ${userId}: ${error.message}`, error.stack);
      throw new Error('Failed to generate and save the book. Please try again.');
    }
  }
  async getBooks(userId: number, promptData: BookGenerationDto): Promise<BookGeneration> {
    try {
      // Generate the book content
      const bookContent = await this.createBookContent(promptData);

      // Generate the book cover image if advanced options are provided
      let coverImageUrl: string | null = null;
      if (promptData.advancedOptions?.coverImagePrompt) {
        coverImageUrl = await this.generateBookCover(promptData.advancedOptions.coverImagePrompt);
      }

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
        additionalData: { fullContent: bookContent, coverImageUrl },
      });

      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(`Book successfully generated and saved for user ${userId}`);
      return savedBook;
    } catch (error) {
      this.logger.error(`Error generating and saving book for user ${userId}: ${error.message}`, error.stack);
      throw new Error('Failed to generate and save the book. Please try again.');
    }
  }

  private async generateBookCover(prompt: string): Promise<string> {
    try {
      const response = await this.openai.images.generate({
        prompt: prompt,
        n: 1, // Number of images to generate
        size: '1024x1024', // Image size
      });

      // Return the URL of the generated image
      return response.data[0].url;
    } catch (error) {
      this.logger.error(`Error generating book cover: ${error.message}`, error.stack);
      throw new Error('Failed to generate book cover. Please try again.');
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
  
      const bookOutline = await this.textModel.invoke(formattedOutlinePrompt);
  
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
    } catch (error) {
      this.logger.error(`Error generating book content: ${error.message}`, error.stack);
      throw new Error('Failed to generate book content. Please try again.');
    }
  }
  async getAllBooksByUser(userId: number): Promise<BookGeneration[]> {
    return await this.bookGenerationRepository.find({ where: { userId } });
  }
}