import { ChatOpenAI } from '@langchain/openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { BookChapterGenerationDto } from './dto/book-chapter.dto';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { BookChapter } from './entities/book-chapter.entity';
import { Observable } from 'rxjs';

@Injectable()
export class BookChapterService {
  private textModel;
  
  private openai: OpenAI;
  private readonly logger = new Logger(BookChapterService.name);
  private readonly uploadsDir: string;
  
constructor(
    private configService: ConfigService,
     @InjectRepository(BookGeneration)
        private bookGenerationRepository: Repository<BookGeneration>,
       
     @InjectRepository(BookChapter)
        private bookChapterRepository: Repository<BookChapter>,
       
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>
    ) {
      this.uploadsDir = this.setupUploadsDirectory();
  }

    private setupUploadsDirectory(): string {
      const rootDir = process.cwd();
      const uploadsPath = path.join(rootDir, 'uploads');
  
      try {
        if (!fs.existsSync(uploadsPath)) {
          fs.mkdirSync(uploadsPath, { recursive: true });
        }
  
        const directories = ['covers', 'chapters', 'temp','graphs'];
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
   private async initializeAIModels() {
      try {
        const apiKeyRecord:any = await this.apiKeyRepository.find();
        if (!apiKeyRecord) {
          throw new Error('No API keys found in the database.');
        }
  
        this.textModel = new ChatOpenAI({
          openAIApiKey: apiKeyRecord[0].openai_key,
          temperature: 0.4,
          modelName: apiKeyRecord[0].model,
        });
  
        this.openai = new OpenAI({
          apiKey: apiKeyRecord[0].dalle_key,
        });
  
        this.logger.log(`AI Models initialized successfully with model: ${apiKeyRecord[0].model}`);
      } catch (error) {
        this.logger.error(`Failed to initialize AI models: ${error.message}`);
        throw new Error('Failed to initialize AI models.');
      }
    }


    private async* generateChapterStream(prompt: string): AsyncGenerator<string> {
      const response = await this.textModel.invoke(prompt);
      const content = response.content;
      if (!content) {
        throw new Error('No content returned from text model');
      }
      // Simulate streaming by splitting into words
      const words = content.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    private async invokeWithSimulatedStreaming(prompt: string, onToken: (token: string) => void): Promise<string> {
      const response = await this.textModel.invoke(prompt);
      const content = response.content;
      if (!content) {
        throw new Error('No content returned');
      }
      const lines = content.split('\n');
      for (const line of lines) {
        onToken(line + '\n');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return content;
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

      async streamChapterContent(
        input,
        bookInfo: BookGeneration
      ): Promise<Observable<string>> {
        const chapterPrompt = `
          You are a master storyteller and novelist. Please write Chapter ${input.chapterNo} of the book titled "${bookInfo.bookTitle}" in an immersive, vivid, and engaging narrative style.
          The book belongs to the "${bookInfo.genre}" genre. Your chapter should:
          - Develop rich, dynamic characters.
          - Include detailed descriptions and atmospheric dialogue.
          - Progress the overarching narrative, revealing twists and building suspense.
          - Ensure the chapter contains at least ${input.minCharacters ?? 100} characters and no more than ${input.maxCharacters ?? 1000} characters.
          Begin your chapter now:
        `;
      
        return new Observable<string>((subscriber) => {
          (async () => {
            try {
              // Step 1: Stream the chapter text
              let chapterText = '';
              const stream = this.generateChapterStream(chapterPrompt);
              for await (const chunk of stream) {
                // Accumulate the chapter text as it streams
                chapterText += chunk;
                subscriber.next(chunk);  // Stream each text chunk
              }
      
              // Step 2: Generate the images after text is streamed
              const images = await this.generateChapterImages(input, bookInfo);
      
              // Step 3: Format the chapter with both text and images
              const baseUrl = this.configService.get<string>('BASE_URL');
              const chunkSize = Math.ceil(chapterText.length / (images.length + 1));
              const textChunks = chapterText.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || ['No content generated.'];
      
              // Format the chapter with both text and images
              let formattedChapter = `\n\n`; // Removed chapter title here as per your requirements
              for (let i = 0; i < images.length; i++) {
                formattedChapter += `${textChunks[i] || ''}\n\n`;
                formattedChapter += `${images[i].title}\n\n`;
                formattedChapter += `![${images[i].title}](${baseUrl}/uploads/${images[i].url})\n\n`;
              }
      
              // Add remaining text (if any)
              formattedChapter += textChunks[images.length] || '';
      
              // Step 4: Send the formatted chapter to the subscriber
              subscriber.next(formattedChapter);
              subscriber.complete();
            } catch (error) {
              subscriber.error(error);
            }
          })();
        });
      }
      
      
      
      
      private async generateChapterImages(
        input: BookChapterGenerationDto,
        bookInfo: BookGeneration
      ): Promise<{ title: string; url: string }[]> {
        const imageCount = Math.floor(Math.random() * 2) + 2; // Randomly decide between 2 or 3 images
        const chapterImages: { title: string; url: string }[] = [];
      
        for (let imageIndex = 1; imageIndex <= imageCount; imageIndex++) {
          const imageTitlePrompt = `
            Provide a short but descriptive title for an illustration in Chapter ${input.chapterNo} of the book "${bookInfo.bookTitle}".
            The genre is "${bookInfo.genre}".
          `;
          const imageTitleResponse = await this.textModel.invoke(imageTitlePrompt);
          const imageTitle = imageTitleResponse.content?.trim() || `Image ${imageIndex}`;
      
          const imagePrompt = `
            Create an illustration titled "${imageTitle}" for Chapter ${input.chapterNo} in "${bookInfo.bookTitle}".
            The genre is "${bookInfo.genre}".
          `;
          const imageResponse = await this.openai.images.generate({
            prompt: imagePrompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json',
          });
      
          if (imageResponse.data?.[0]?.b64_json) {
            const savedImagePath = await this.saveImage(
              `data:image/png;base64,${imageResponse.data[0].b64_json}`,
              `${bookInfo.bookTitle}_chapter_${input.chapterNo}_image_${imageIndex}`,
              'chapters'
            );
            chapterImages.push({ title: imageTitle, url: savedImagePath });
          } else {
            this.logger.warn(`Image ${imageIndex} for Chapter ${input.chapterNo} was not generated.`);
          }
        }
      
        return chapterImages;
      }
      
        private async ChapterContent(
          promptData: BookChapterGenerationDto,
          bookInfo: BookGeneration,
          onTextUpdate
        ): Promise<string> {
          try {
            const chapterTitle = `Chapter ${promptData.chapterNo}: ${bookInfo.bookTitle}`;
            const chapterPrompt = `
            You are a master storyteller and novelist. Please write Chapter ${promptData.chapterNo} of the book titled "${bookInfo.bookTitle}" in an immersive, vivid, and engaging narrative style.
            The book belongs to the "${bookInfo.genre}" genre. Your chapter should:
            - Develop rich, dynamic characters.
            - Include detailed descriptions and atmospheric dialogue.
            - Progress the overarching narrative, revealing twists and building suspense.
            - Ensure the chapter contains at least ${promptData.minCharacters ?? 100} characters and no more than ${promptData.maxCharacters ?? 1000} characters.
            Begin your chapter now:
          `;
            let chapterText = '';
            chapterText = await this.invokeWithSimulatedStreaming.call(this, chapterPrompt, (token: string) => {
              process.stdout.write(token);
              chapterText += token;
              onTextUpdate(token)
            });
        
            if (!chapterText || chapterText.trim() === '') {
              throw new Error(`Chapter ${promptData.chapterNo} content is empty or undefined`);
            }
        
            const imageCount = Math.floor(Math.random() * 2) + 2;
            const chapterImages: { title: string; url: string }[] = [];
            for (let imageIndex = 1; imageIndex <= imageCount; imageIndex++) {
              const imageTitlePrompt = `
                Provide a short but descriptive title for an illustration in Chapter ${promptData.chapterNo} of the book "${bookInfo.bookTitle}".
                The genre is "${bookInfo.genre}".
              `;
              const imageTitleResponse = await this.textModel.invoke(imageTitlePrompt);
              const imageTitle = imageTitleResponse.content?.trim() || `Image ${imageIndex}`;
              const imagePrompt = `
                Create an illustration titled "${imageTitle}" for Chapter ${promptData.chapterNo} in "${bookInfo.bookTitle}".
                The genre is "${bookInfo.genre}".
              `;
              
              const imageResponse = await this.openai.images.generate({
                prompt: imagePrompt,
                n: 1,
                size: '1024x1024',
                response_format: 'b64_json',
              });
              if (imageResponse.data?.[0]?.b64_json) {
                const savedImagePath = await this.saveImage(
                  `data:image/png;base64,${imageResponse.data[0].b64_json}`,
                  `${bookInfo.bookTitle}_chapter_${promptData.chapterNo}_image_${imageIndex}`,
                  'chapters'
                );
                chapterImages.push({ title: imageTitle, url: savedImagePath });
              } else {
                this.logger.warn(`Image ${imageIndex} for Chapter ${promptData.chapterNo} was not generated.`);
              }
            }
        
            const baseUrl = this.configService.get<string>('BASE_URL');
            const chunkSize = Math.ceil(chapterText.length / (chapterImages.length + 1));
            const textChunks = chapterText.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || ['No content generated.'];
        
            let formattedChapter = `${chapterTitle}\n\n`; // Include chapter title at the beginning

            for (let i = 0; i < chapterImages.length; i++) {
              formattedChapter += `${textChunks[i] || ''}\n\n`;
              formattedChapter += `${chapterImages[i].title}\n\n`;
              formattedChapter += `![${chapterImages[i].title}](${baseUrl}/uploads/${chapterImages[i].url})\n\n`;
            }
            formattedChapter += textChunks[chapterImages.length] || '';  // Add the remaining text
            return formattedChapter;
          } catch (error) {
            console.error('Error generating chapter content with images:', error);
            throw new Error('Failed to generate chapter content with images');
          }
        }
        

 async generateChapterOfBook(userId: number, input: BookChapterGenerationDto,onTextUpdate:(text:string)=>void) {
     await this.initializeAIModels();
     const bookInfo = await this.bookGenerationRepository.findOne({ where: { id: input.bookGenerationId } });
     const chapters = await this.ChapterContent(input, bookInfo,onTextUpdate);
     const bookChapter = new BookChapter();
     bookChapter.bookGeneration = bookInfo;
     bookChapter.maxCharacters = input.maxCharacters;
     bookChapter.minCharacters = input.minCharacters;
     bookChapter.chapterNo = input.chapterNo;
     bookChapter.chapterInfo =  chapters ;
     const savedMetadataBook = await this.bookChapterRepository.save(bookChapter);
     return savedMetadataBook;
   }
   async getBook(id:number) {
     return await this.bookGenerationRepository.findOne( {where:{id}} );
 
   }
 
}
