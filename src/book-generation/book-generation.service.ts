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
  private async generateBookBackgroundCover(promptData: BookGenerationDto): Promise<string> {
    try {
      const allowedSizes = ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'] as const;
      type AllowedSize = typeof allowedSizes[number];

      const imageSize = this.configService.get<string>('IMAGE_SIZE') as AllowedSize;

      if (!allowedSizes.includes(imageSize)) {
        throw new Error(`Invalid image size: ${imageSize}. Allowed sizes are: ${allowedSizes.join(', ')}`);
      }

      const coverImagePrompt = promptData.advancedOptions?.coverImagePrompt || 
        `Create a professional book back cover for "${promptData.bookTitle}", a ${promptData.genre} book.`;

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


  private async introductionContent(promptData: BookGenerationDto): Promise<string> {
    try {
      const sections: string[] = [];
  
      // Cover Page
      const coverPagePrompt = `
  Create a professional Cover Page with the following details:
  - Title: "${promptData.bookTitle}"
  - Author: "${promptData.authorName || 'Anonymous'}"
  - Publisher: Cyberify
  - Include the Cyberify logo prominently on the cover. The logo is located at "${this.uploadsDir}/temp/logo.jfif". Ensure the logo is a central branding element.
  - Design the cover to reflect the theme "${promptData.theme}" and genre "${promptData.genre}" of the book.
`;
const coverPage = await this.textModel.invoke(coverPagePrompt); // Replace with actual API call or logic
sections.push(` Cover Page\n${coverPage}\n`);

      // Dedication Page
      const dedicationPrompt = `
        Write a dedication for the book titled "${promptData.bookTitle}".
      `;
      const dedication = await this.textModel.invoke(dedicationPrompt); // Replace with actual API call or logic
      sections.push(`Dedication\n${dedication}\n`);
  
      // Preface/Introduction
      const prefacePrompt = `
      Write a compelling preface for the book titled "${promptData.bookTitle}".
      Include the following sections in the preface:
      - Coverage: Provide an overview of the topics covered in the book, emphasizing how they relate to the theme and genre.
      - Use in the Curriculum: Explain how the book can be utilized in educational settings or by specific audiences (e.g., students, professionals, or enthusiasts).
      - Prerequisites: Mention any prior knowledge, background, or interests the readers should have to fully appreciate the book.
      - Goals: State the primary goals of the book, such as what the readers will learn, experience, or take away by the end.
      - Acknowledgements: Express gratitude to individuals, teams, or entities that contributed to the creation of the book.
      Ensure each section is detailed, written in an engaging and professional tone, and separated clearly for readability.
    `;
    const preface = await this.textModel.invoke(prefacePrompt); // Replace with actual API call or logic
    sections.push(` Preface\n${preface}\n`);
    
  
      // Table of Contents
      const tableOfContentsPrompt = `
      Create a well-structured Table of Contents for a book with ${promptData.numberOfChapters} chapters in the following format:
      - Start with the word "Contents" at the top.
      - Use roman numerals for introductory sections like Preface or Foreword.
      - For each chapter, include the chapter number, title, and page number (example page numbers can be used).
      - Subsections should be indented and include subtitles with their respective page numbers.
      - Example Format:
        
        Contents
        Preface . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . v
        Chapter 1: The Awakening . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 1
          1.1 Discovery of the Prophecy . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 4
          1.2 The Dragon's Warning . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 10
        Chapter 2: Shadows of the Past . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 15
          2.1 The Ruins of the Old City . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 18
          2.2 Unearthing the Truth . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 25
        Chapter 3: The Final Revelation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 32
    
      Continue for all chapters, making sure the format is consistent.
    `;
    const tableOfContents = await this.textModel.invoke(tableOfContentsPrompt); // Replace with actual API call or logic
    sections.push(` Table of Contents\n${tableOfContents}\n`);
    
  
      // Introduction
      const {
        bookTitle,
        subtitle,
        authorName,
        authorBio,
        genre,
        theme,
        characters,
        setting,
        tone,
        targetAudience,
        language,
        additionalContent,
        numberOfChapters,
        numberOfPages,
        plotTwists,
      } = promptData;
  
      let introduction = ` Introduction\n\n`;
      introduction += ` ${bookTitle}\n\n`;
      if (subtitle) {
        introduction += ` ${subtitle}\n\n`;
      }
      if (authorName) {
        introduction += `By ${authorName}\n\n`;
      }
      if (authorBio) {
        introduction += `${authorBio}\n\n`;
      }
  
      introduction += `Welcome to the world of *${bookTitle}*, a ${genre} novel that explores the theme of ${theme}. `;
      introduction += `Set in ${setting}, this story follows ${characters} as they navigate a world filled with ${tone} and unexpected ${plotTwists}.\n\n`;
  
      introduction += `This book is crafted for ${targetAudience}, offering a captivating journey through ${language} that will keep you hooked from the first page to the last. `;
      introduction += `With ${numberOfChapters} chapters spanning ${numberOfPages} pages, *${bookTitle}* promises a rich and immersive experience.\n\n`;
  
      if (additionalContent) {
        introduction += `${additionalContent}\n\n`;
      }
  
      introduction += `Prepare yourself for a tale that blends ${theme} with ${tone}, set against the backdrop of ${setting}. `;
      introduction += `Whether you're a fan of ${genre} or new to the genre, this book is sure to leave a lasting impression.\n\n`;
  
      sections.push(introduction);
  
      // Combine all sections into a single string
      const frontMatterContent = sections.join('\n');
      return frontMatterContent;
    } catch (error) {
      console.error('Error generating introduction content:', error);
      throw new Error('Failed to generate introduction content');
    }
  }
  private async ChapterContent(promptData: BookGenerationDto): Promise<string[]> {
    try {
        const chapters: string[] = [];

        for (let i = 1; i <= promptData.numberOfChapters; i++) {
            const chapterTitle = `Chapter ${i}`;

            // Generate the chapter text
            const chapterPrompt = `
                Write Chapter ${i} of the book titled "${promptData.bookTitle}".
                The genre of the book is "${promptData.genre}", and the central theme is "${promptData.theme}".
                The story follows ${promptData.characters} in the setting of ${promptData.setting}.
                The tone of the book is ${promptData.tone}, and it includes elements like ${promptData.plotTwists}.
                Ensure the chapter is engaging and aligns with the overall narrative of the book.
            `;
            const chapterText = await this.textModel.invoke(chapterPrompt);

            // Randomly decide the number of images (between 4 and 10)
            const imageCount = Math.floor(Math.random() * 7) + 4; // Generates a number between 4 and 10
            const chapterImages: { title: string; url: string }[] = [];

            for (let j = 1; j <= imageCount; j++) {
                const imageTitlePrompt = `Provide a short but descriptive title for an illustration in Chapter ${i} of the book "${promptData.bookTitle}". 
                    The genre is ${promptData.genre}, theme is ${promptData.theme}, and setting is ${promptData.setting}.`;

                const imageTitle = await this.textModel.invoke(imageTitlePrompt);

                const imagePrompt = `Create an illustration titled "${imageTitle}" for Chapter ${i} in "${promptData.bookTitle}". 
                    The genre is ${promptData.genre}, theme is ${promptData.theme}, and setting is ${promptData.setting}. 
                    Ensure the image reflects the tone: ${promptData.tone}.`;

                const response = await this.openai.images.generate({
                    prompt: imagePrompt,
                    n: 1,
                    size: '1024x1024',
                    response_format: 'b64_json',
                });

                if (response.data[0]?.b64_json) {
                    const imagePath = await this.saveImage(
                        `data:image/png;base64,${response.data[0].b64_json}`,
                        `${promptData.bookTitle}_chapter_${i}_image_${j}`
                    );
                    chapterImages.push({ title: imageTitle, url: imagePath });
                }
            }

            const imagePath = this.configService.get<string>('BASE_URL');

            // Split the chapter text into sections based on the number of images
            const textChunks = chapterText.match(new RegExp(`.{1,${Math.ceil(chapterText.length / (imageCount + 1))}}`, 'g')) || [];

            let formattedChapter = `\n\n ${chapterTitle}\n\n`;

            for (let j = 0; j < chapterImages.length; j++) {
                formattedChapter += `${textChunks[j] || ''}\n\n`;

                formattedChapter += ` ${chapterImages[j].title}\n\n`;
                formattedChapter += `![${chapterImages[j].title}](${imagePath}/uploads/${chapterImages[j].url})\n\n`;
            }

            // Append any remaining text after the last image
            formattedChapter += textChunks[chapterImages.length] || '';

            chapters.push(formattedChapter);
        }

        return chapters;
    } catch (error) {
        console.error('Error generating chapter content with images:', error);
        throw new Error('Failed to generate chapter content with images');
    }
}


  private async endOfBookContent(promptData: BookGenerationDto): Promise<string> {
    try {
      const sections: string[] = [];
  
      // Glossary
      const glossaryPrompt = `
        Create a glossary for the book titled "${promptData.bookTitle}". Include definitions of key terms used in the book.
      `;
      const glossary = await this.textModel.invoke(glossaryPrompt); // Replace with actual API call or logic
      sections.push(` Glossary\n${glossary}\n`);
  
      // Index
      const indexPrompt = `
        Create an index for the book titled "${promptData.bookTitle}". Include key topics with page numbers.
      `;
      const index = await this.textModel.invoke(indexPrompt); // Replace with actual API call or logic
      sections.push(` Index\n${index}\n`);
  
      // References/Bibliography
      const referencesPrompt = `
        Write a bibliography for the book titled "${promptData.bookTitle}". Include any references or inspirations.
      `;
      const references = await this.textModel.invoke(referencesPrompt); // Replace with actual API call or logic
      sections.push(` References\n${references}\n`);
  
      // Back Cover
      const backCoverPrompt = `
        Write a back cover summary for the book titled "${promptData.bookTitle}".
        Include a summary of the book and a brief author profile.
      `;
      const backCover = await this.textModel.invoke(backCoverPrompt); // Replace with actual API call or logic
      sections.push(` Back Cover\n${backCover}\n`);
  
      // Combine all sections into a single string
      const endOfBookContent = sections.join('\n');
      return endOfBookContent;
    } catch (error) {
      console.error('Error generating end-of-book content:', error);
      throw new Error('Failed to generate end-of-book content');
    }
  }
 
  private async createBookContent(promptData: BookGenerationDto): Promise<string> {
    try {
      const sections: string[] = [];
  
      // Generate Introduction Content
      const introduction = await this.introductionContent(promptData);
      sections.push(introduction);
  
      // Generate Chapter Content
      const chapters = await this.ChapterContent(promptData);
      sections.push(...chapters);
  
      // Generate End-of-Book Content
      const endOfBook = await this.endOfBookContent(promptData);
      sections.push(endOfBook);
  
      // Combine all sections into a single string
      const fullBookContent = sections.join('\n\n');
      return fullBookContent;
    } catch (error) {
      this.logger.error(`Error creating book content: ${error.message}`);
      throw new Error('Failed to create book content');
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
      const backgroundImagePath = await this.generateBookBackgroundCover(promptData);

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
        fullContent: bookContent,
        backCoverImageUrl: backgroundImagePath
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


