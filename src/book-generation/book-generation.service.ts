import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAI as LangchainOpenAI } from "@langchain/openai"; // For text generation
import { PromptTemplate } from "@langchain/core/prompts";
import { ConfigService } from '@nestjs/config';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { BookGeneration } from './entities/book-generation.entity';
import OpenAI from 'openai'; // For DALL·E image generation
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BookGenerationService {
  private textModel: LangchainOpenAI;
  private openai: OpenAI;
  private readonly logger = new Logger(BookGenerationService.name);
  private readonly uploadsDir: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>
  ) {
    this.textModel = new LangchainOpenAI({
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      temperature: 0.4,
      modelName: 'gpt-3.5-turbo',
    });

    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('DALLE_API_KEY'),
    });

    this.uploadsDir = this.setupUploadsDirectory();
  }

  private setupUploadsDirectory(): string {
    const rootDir = process.cwd();
    const uploadsPath = path.join(rootDir, 'uploads');

    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      const directories = ['covers', 'chapters', 'temp'];
      directories.forEach(dir => {
        const dirPath = path.join(uploadsPath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });

      this.logger.log(`Uploads directory setup complete at: ${uploadsPath}`);
      return uploadsPath;
    } catch (error) {
      this.logger.error(`Error setting up uploads directory: ${error.message}`);
      throw new Error('Failed to setup uploads directory');
    }
  }

  private async saveImage(imageData: string, fileName: string, subDirectory: string = 'covers'): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, subDirectory);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fullFileName = `${sanitizedFileName}_${timestamp}.png`;
      const filePath = path.join(dirPath, fullFileName);

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

      this.logger.log(`Image saved successfully: ${filePath}`);
      return path.join(subDirectory, fullFileName);
    } catch (error) {
      this.logger.error(`Error saving image: ${error.message}`);
      throw new Error('Failed to save image');
    }
  }

  private async generateBookCover(promptData: BookGenerationDto): Promise<string> {
    try {
      const allowedSizes = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'] as const;
      type AllowedSize = typeof allowedSizes[number];

      const imageSize = this.configService.get<string>('IMAGE_SIZE') as AllowedSize;

      if (!allowedSizes.includes(imageSize)) {
        throw new Error(`Invalid image size: ${imageSize}. Allowed sizes are: ${allowedSizes.join(', ')}`);
      }

      const coverImagePrompt = promptData.advancedOptions?.coverImagePrompt || 
        `Create a professional book cover for "${promptData.bookTitle}", a ${promptData.genre} book.`;

      const response = await this.openai.images.generate({
        prompt: coverImagePrompt,
        n: 1,
        size: imageSize,
        response_format: 'b64_json'
      });

      if (!response.data[0]?.b64_json) {
        throw new Error('No image data received from OpenAI');
      }

      const imagePath = await this.saveImage(
        `data:image/png;base64,${response.data[0].b64_json}`,
        promptData.bookTitle
      );

      return imagePath;
    } catch (error) {
      this.logger.error(`Error generating book cover: ${error.message}`);
      throw new Error('Failed to generate book cover');
    }
  }

  private getDefaultStyling() {
    return {
      fontSize: {
        title: '32px',
        chapterTitle: '24px',
        headers: '20px',
        body: '16px'
      },
      fontFamily: {
        title: 'Georgia, serif',
        chapterTitle: 'Georgia, serif',
        headers: 'Georgia, serif',
        body: 'Georgia, serif'
      },
      lineHeight: {
        title: '1.5',
        chapterTitle: '1.4',
        headers: '1.3',
        body: '1.6'
      },
      textAlignment: {
        title: 'center',
        chapterTitle: 'left',
        headers: 'left',
        body: 'justify'
      },
      margins: {
        top: '2.5cm',
        bottom: '2.5cm',
        left: '3cm',
        right: '3cm'
      },
      spacing: {
        paragraphSpacing: '1.5em',
        chapterSpacing: '3em',
        sectionSpacing: '2em'
      },
      pageLayout: {
        pageSize: 'A5',
        orientation: 'portrait',
        columns: 1
      }
    };
  }

  private async createBookContent(promptData: BookGenerationDto): Promise<string> {
    try {
      const sections = [];

      // Generate Graphics for Atlantis
      const graphicPrompt = `
        Create a high-quality image depicting Atlantis with professional design aesthetics.
      `;
      const graphicResponse = await this.openai.images.generate({
        prompt: graphicPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      });

      let graphicPath = '';
      if (graphicResponse.data[0]?.b64_json) {
        graphicPath = await this.saveImage(
          `data:image/png;base64,${graphicResponse.data[0].b64_json}`,
          'cyberify_logo'
        );
      }
      sections.push(`<graphic>${graphicPath}</graphic>`);

      // Additional Design Elements
      const additionalElementsPrompt = `
        Include placeholders for:
        - [Insert Cyberify logo and name prominently on the cover]
        - [Add design elements or symbols representing the theme and genre of the book].
      `;
      const additionalElements = await this.textModel.invoke(additionalElementsPrompt);
      sections.push(`<additional-elements>${additionalElements}</additional-elements>`);

      // Cover Page
      const coverPagePrompt = `
        Create a professional Cover Page with the following details:
        - Title: "${promptData.bookTitle}"
        - Author: "${promptData.authorName || 'Anonymous'}"
        - Publisher: Cyberify
        - Include Cyberify logo prominently.
        - Include space for relevant images or graphics (e.g., related to the book's theme).
        - Make it visually appealing with professional design elements.
      `;
      const coverPage = await this.textModel.invoke(coverPagePrompt);
      sections.push(`<cover-page>${coverPage}</cover-page>`);

      // Dedication Page
      const dedicationPrompt = `
        Write a dedication for the book titled "${promptData.bookTitle}".
      `;
      const dedication = await this.textModel.invoke(dedicationPrompt);
      sections.push(`<dedication>${dedication}</dedication>`);

      // Preface/Introduction
      const prefacePrompt = `
        Write a compelling preface for the book titled "${promptData.bookTitle}".
        Explain the purpose and inspiration behind the book.
      `;
      const preface = await this.textModel.invoke(prefacePrompt);
      sections.push(`<preface>${preface}</preface>`);

      // Table of Contents
      const tableOfContentsPrompt = `
        Create a Table of Contents for a book with ${promptData.numberOfChapters} chapters. Include chapter titles.
      `;
      const tableOfContents = await this.textModel.invoke(tableOfContentsPrompt);
      sections.push(`<table-of-contents>${tableOfContents}</table-of-contents>`);

      // Chapters
      const chapters: string[] = [];
      for (let i = 1; i <= promptData.numberOfChapters; i++) {
        const chapterPrompt = `
          Write Chapter ${i} of the book titled "${promptData.bookTitle}".
          Include engaging content with the genre "${promptData.genre}" and theme "${promptData.theme}".
        `;
        const chapterContent = await this.textModel.invoke(chapterPrompt);
        chapters.push(chapterContent);
      }
      chapters.forEach((chapter, index) => {
        sections.push(`<chapter number="${index + 1}">${chapter}</chapter>`);
      });

      // Glossary
      const glossaryPrompt = `
        Create a glossary for the book titled "${promptData.bookTitle}". Include definitions of key terms used in the book.
      `;
      const glossary = await this.textModel.invoke(glossaryPrompt);
      sections.push(`<glossary>${glossary}</glossary>`);

      // Index
      const indexPrompt = `
        Create an index for the book titled "${promptData.bookTitle}". Include key topics with page numbers.
      `;
      const index = await this.textModel.invoke(indexPrompt);
      sections.push(`<index>${index}</index>`);

      // References/Bibliography
      const referencesPrompt = `
        Write a bibliography for the book titled "${promptData.bookTitle}". Include any references or inspirations.
      `;
      const references = await this.textModel.invoke(referencesPrompt);
      sections.push(`<references>${references}</references>`);

      // Back Cover
      const backCoverPrompt = `
        Write a back cover summary for the book titled "${promptData.bookTitle}".
        Include a summary and author profile.
      `;
      const backCover = await this.textModel.invoke(backCoverPrompt);
      sections.push(`<back-cover>${backCover}</back-cover>`);

      // Combine all sections into one string
      const fullBookContent = sections.join('\n\n');
      return fullBookContent;
    } catch (error) {
      this.logger.error(`Error generating book content: ${error.message}`);
      throw new Error('Failed to generate book content');
    }
  }

  async getAllBooksByUser(userId: number): Promise<BookGeneration[]> {
    return await this.bookGenerationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async generateAndSaveBook(userId: number, promptData: BookGenerationDto): Promise<BookGeneration> {
    try {
      const bookContent = await this.createBookContent(promptData);
      const coverImagePath = await this.generateBookCover(promptData);

      const book = new BookGeneration();
      book.userId = userId;
      book.bookTitle = promptData.bookTitle;
      book.genre = promptData.genre;
      book.theme = promptData.theme;
      book.characters = promptData.characters;
      book.setting = promptData.setting;
      book.tone = promptData.tone;
      book.plotTwists = promptData.plotTwists;
      book.numberOfPages = promptData.numberOfPages;
      book.numberOfChapters = promptData.numberOfChapters;
      book.targetAudience = promptData.targetAudience;
      book.language = promptData.language;
      book.additionalContent = promptData.additionalContent;
      book.additionalData = {
        coverImageUrl: coverImagePath,
        styling: this.getDefaultStyling(),
        fullContent: bookContent
      };

      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(`Book saved successfully for user ${userId}: ${promptData.bookTitle}`);

      return savedBook;
    } catch (error) {
      this.logger.error(`Error generating and saving book: ${error.message}`);
      throw new Error('Failed to generate and save book');
    }
  }
}


