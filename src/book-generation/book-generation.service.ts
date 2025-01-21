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
      // Step 1: Generate the book outline with improved prompt
      const outlinePromptTemplate = new PromptTemplate({
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
  
      // Step 2: Enhanced chapter generation prompt
      const chapterPromptTemplate = new PromptTemplate({
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
  
      // Build the complete book content
      let fullBookContent = '';
  
      // Add title page
      fullBookContent += `${promptData.bookTitle}\n\n`;
  
      // Generate and add introduction
      const introductionPrompt = new PromptTemplate({
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
  
      // Generate chapters
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
  
      // Generate epilogue/conclusion
      const conclusionPrompt = new PromptTemplate({
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
    } catch (error) {
      this.logger.error(`Error generating book content: ${error.message}`, error.stack);
      throw new Error('Failed to generate book content. Please try again.');
    }
  }
  async getAllBooksByUser(userId: number): Promise<BookGeneration[]> {
    return await this.bookGenerationRepository.find({ where: { userId } });
  }
}