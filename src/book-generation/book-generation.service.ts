import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatOpenAI, OpenAI as LangchainOpenAI } from "@langchain/openai"; // For text generation
import { PromptTemplate } from "@langchain/core/prompts";
import { ConfigService } from '@nestjs/config';
import { BookGeneration } from './entities/book-generation.entity';
import OpenAI from 'openai'; // For DALL·E image generation
import * as fs from 'fs';
import * as path from 'path';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { exec } from 'child_process';
import mermaid from 'mermaid';
import { BookGenerationDto, SearchDto } from './dto/book-generation.dto';

@Injectable()
export class BookGenerationService {
  private textModel;
  
  private openai: OpenAI;
  private readonly logger = new Logger(BookGenerationService.name);
  private readonly uploadsDir: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(BookGeneration)
    private bookGenerationRepository: Repository<BookGeneration>,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>
    ) {
      this.uploadsDir = this.setupUploadsDirectory();
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


  
  private async saveFlowchartImage(mermaidCode: string, fileName: string): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, 'flowcharts');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
  
      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const mermaidFilePath = path.join(dirPath, `${sanitizedFileName}_${timestamp}.mmd`);
      const svgFilePath = path.join(dirPath, `${sanitizedFileName}_${timestamp}.svg`);
  
      // Write Mermaid.js syntax to a file
      fs.writeFileSync(mermaidFilePath, mermaidCode, 'utf-8');
  
      // Use mermaid-cli (mmdc) to generate SVG
      await new Promise((resolve, reject) => {
        exec(`npx mmdc -i "${mermaidFilePath}" -o "${svgFilePath}"`, (error, stdout, stderr) => {
          if (error) {
            reject(`Error executing Mermaid CLI: ${stderr}`);
          } else {
            resolve(stdout);
          }
        });
      });
  
      this.logger.log(`Flowchart saved: ${svgFilePath}`);
      return path.join('flowcharts', `${sanitizedFileName}_${timestamp}.svg`);
    } catch (error) {
      this.logger.error(`Error saving flowchart: ${error.message}`);
      throw new Error('Failed to save flowchart');
    }
  }
  private async saveDiagramImage(mermaidCode: string, fileName: string): Promise<string> {
    try {
      const dirPath = path.join(this.uploadsDir, 'graphs');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
  
      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const mermaidFilePath = path.join(dirPath, `${sanitizedFileName}_${timestamp}.mmd`);
      const svgFilePath = path.join(dirPath, `${sanitizedFileName}_${timestamp}.svg`);
  
      // Write Mermaid.js syntax to a file
      fs.writeFileSync(mermaidFilePath, mermaidCode, 'utf-8');
  
      // Use mermaid-cli (mmdc) to generate SVG
      await new Promise((resolve, reject) => {
        exec(`npx mmdc -i "${mermaidFilePath}" -o "${svgFilePath}"`, (error, stdout, stderr) => {
          if (error) {
            reject(`Error executing Mermaid CLI: ${stderr}`);
          } else {
            resolve(stdout);
          }
        });
      });
  
      this.logger.log(`Flowchart saved: ${svgFilePath}`);
      return path.join('graphs', `${sanitizedFileName}_${timestamp}.svg`);
    } catch (error) {
      this.logger.error(`Error saving flowchart: ${error.message}`);
      throw new Error('Failed to save flowchart');
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
    diagramConfig: {
      theme: 'base',
      themeVariables: {
        primaryColor: '#F6F6F6',
        edgeLabelBackground: '#FFFFFF',
        fontSize: '16px',
        fontFamily: 'Arial'
      }
    },
    diagramStyles: {
      decisionNodes: { shape: 'diamond', color: '#FFA500' },
      actionNodes: { shape: 'rect', color: '#87CEEB' },
      outcomeNodes: { shape: 'roundRect', color: '#90EE90' }
    }
  };
}


  private async introductionContent(promptData: BookGenerationDto): Promise<string> {
    try {
      const sections: string[] = [];
      const coverPagePrompt = `
        Create a professional Cover Page with the following details:
        - Title: "${promptData.bookTitle}"
        - Author: "${promptData.authorName || 'Anonymous'}"
        - Publisher: Cyberify
        - Include the Cyberify logo prominently on the cover. The logo is located at "${this.uploadsDir}/temp/logo.jfif". Ensure the logo is a central branding element.
        - Design the cover to reflect the theme "${promptData.theme}" and genre "${promptData.genre}" of the book.
      `;
      const coverPageResponse = await this.textModel.invoke(coverPagePrompt);

      const coverPage = typeof coverPageResponse === 'string' 
        ? coverPageResponse 
        : coverPageResponse?.text || JSON.stringify(coverPageResponse);

      sections.push(` Cover Page\n${coverPage}\n`);

      // Dedication Page
      const dedicationPrompt = `
        Write a dedication for the book titled "${promptData.bookTitle}".
      `;
      const dedicationResponse = await this.textModel.invoke(dedicationPrompt); 
      const dedication = typeof dedicationResponse === 'string' 
      ? dedicationResponse 
      : dedicationResponse?.text || JSON.stringify(dedicationResponse);

      sections.push(`Dedication\n${dedication}\n`);

      // Preface/Introduction
      const prefacePrompt = `
        Write a compelling preface for the book titled "${promptData.bookTitle}".
        Include sections like Overview, Use in Curriculum, Goals, and Acknowledgments.
      `;
      const prefaceResponse = await this.textModel.invoke(prefacePrompt); 
      const preface = typeof prefaceResponse === 'string' 
      ? prefaceResponse 
      : prefaceResponse?.text || JSON.stringify(prefaceResponse);

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
      const tableOfContentsResponse = await this.textModel.invoke(tableOfContentsPrompt);
      const tableOfContents = typeof tableOfContentsResponse === 'string' 
      ? tableOfContentsResponse 
      : tableOfContentsResponse?.text || JSON.stringify(tableOfContentsResponse);

      sections.push(` Table of Contents\n${tableOfContents}\n`);
    
      return sections.join('\n');
    } catch (error) {
      this.logger.error(`Error generating introduction content: ${error.message}`);
      throw new Error('Failed to generate introduction content');
    }
  }
  private async generateDiagram(chapterContent: string, chapterNumber: number, bookTitle: string): Promise<string> {
    try {
      const diagramPrompt = `
        Analyze this chapter content and generate a Mermaid.js diagram:
        "${chapterContent}"
        
        Requirements:
        - Use either graph TD (top-down) or graph LR (left-right)
        - Focus on character interactions and plot progression
        - Include key decision points and consequences
        - Use emojis in node labels where appropriate
        - Maximum 15 nodes
        - Style Requirement: ${this.getDefaultStyling().diagramStyles}
  
        Format:
        graph TD
          A[Start] --> B{Decision}
          B -->|Yes| C[Action 1]
          B -->|No| D[Action 2]
      `;
  
      const response = await this.textModel.invoke(diagramPrompt);
      let diagramCode = response.content.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  
      // Add styling configuration
      diagramCode = `%%{init: ${JSON.stringify(this.getDefaultStyling().diagramConfig)} }%%\n${diagramCode}`;
  
      return this.saveDiagramImage(diagramCode, `chapter_${chapterNumber}_diagram`);
    } catch (error) {
      this.logger.error(`Diagram generation failed: ${error.message}`);
      return ''; // Fail gracefully
    }
  }
  
  
  private async ChapterContent(promptData: BookGenerationDto): Promise<string[]> {
    try {
        const chapters: string[] = [];
        let flowchartPath,diagramPath

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

            // Ensure chapterText is a string
            const chapterTextRaw = await this.textModel.invoke(chapterPrompt);
            const chapterText = chapterTextRaw.content;

            if (!chapterText) {
                throw new Error(`Chapter ${i} content is empty or undefined`);
            }
            if(promptData.isFlowChart){
            const flowchartDescription = `
        A flowchart describing the main events and key decision points in Chapter ${i} of "${promptData.bookTitle}".
        The genre is "${promptData.genre}", the theme is "${promptData.theme}", and the tone is "${promptData.tone}".
        The setting is "${promptData.setting}". Focus on key decision moments and actions that drive the story forward.
      `;
       flowchartPath = await this.generateFlowchart(flowchartDescription);
    }
    
          // Generate a diagram (Mermaid) for the chapter, incorporating similar elements
          if(promptData.isDiagram){
         const diagramDescription = `
          A diagram illustrating the key actions in Chapter ${i} of "${promptData.bookTitle}".
          The genre is "${promptData.genre}", the theme is "${promptData.theme}", and the tone is "${promptData.tone}".
          The setting is "${promptData.setting}". Depict key events and decisions visually.
        `;
          //  diagramPath = await this.generateDiagram(diagramDescription,i,promptData.bookTitle);
    
}
            // Randomly decide the number of images (between 4 and 10)
          const imageCount = Math.floor(Math.random() * 2) + 2; // Generates a number between 2 and 3
   const chapterImages: { title: string; url: string }[] = [];

            for (let j = 1; j <= imageCount; j++) {
                const imageTitlePrompt = `Provide a short but descriptive title for an illustration in Chapter ${i} of the book "${promptData.bookTitle}". 
                    The genre is ${promptData.genre}, theme is ${promptData.theme}, and setting is ${promptData.setting}.`;

                const imageTitle = await this.textModel.invoke(imageTitlePrompt);

                const imagePrompt = `Create an illustration titled "${imageTitle.content}" for Chapter ${i} in "${promptData.bookTitle}". 
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
                        `${promptData.bookTitle}_chapter_${i}_image_${j}`,
                        "chapters"
                    );
                    chapterImages.push({ title: imageTitle.content, url: imagePath });
                }
            }

            const imagePath = this.configService.get<string>('BASE_URL');

            // Split the chapter text into sections based on the number of images
            const textChunks = (chapterText.match(new RegExp(`.{1,${Math.ceil(chapterText.length / (imageCount + 1))}}`, 'g'))) || ["No content generated."];

            let formattedChapter = `\n\n ${chapterTitle}\n\n`;

            for (let j = 0; j < chapterImages.length; j++) {
                formattedChapter += `${textChunks[j] || ''}\n\n`;
                formattedChapter += ` ${chapterImages[j].title}\n\n`;
                formattedChapter += `![${chapterImages[j].title}](${imagePath}/uploads/${chapterImages[j].url})\n\n`;
            }

            // Append any remaining text after the last image
            formattedChapter += textChunks[chapterImages.length] || '';
         if(promptData.isFlowChart)   formattedChapter += `\n\n Flowchart\n![Flowchart](${this.configService.get<string>('BASE_URL')}/uploads/${flowchartPath})\n`;
          //  if(promptData.isDiagram)  formattedChapter += `\n\n Diagram\n![Diagram](${this.configService.get<string>('BASE_URL')}/uploads/${diagramPath})\n`;
      
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
      const glossaryResponse = await this.textModel.invoke(glossaryPrompt); // Replace with actual API call or logic
      const glossary = typeof glossaryResponse === 'string' 
      ? glossaryResponse 
      : glossaryResponse?.text || JSON.stringify(glossaryResponse);

      sections.push(` Glossary\n${glossary}\n`);
  
      // Index
      const indexPrompt = `
        Create an index for the book titled "${promptData.bookTitle}". Include key topics with page numbers.
      `;
      const indexResponse = await this.textModel.invoke(indexPrompt); // Replace with actual API call or logic
     const prefacePrompt = `
        Write a compelling preface for the book titled "${promptData.bookTitle}".
        Include sections like Overview, Use in Curriculum, Goals, and Acknowledgments.
      `;
      const prefaceResponse = await this.textModel.invoke(prefacePrompt); 
      const preface = typeof prefaceResponse === 'string' 
      ? prefaceResponse 
      : prefaceResponse?.text || JSON.stringify(prefaceResponse);

      sections.push(` Preface\n${preface}\n`);
      const index = typeof indexResponse === 'string' 
      ? indexResponse 
      : indexResponse?.text || JSON.stringify(indexResponse);

      sections.push(` Index\n${index}\n`);
  
      // References/Bibliography
      const referencesPrompt = `
        Write a bibliography for the book titled "${promptData.bookTitle}". Include any references or inspirations.
      `;
      const referencesResponse = await this.textModel.invoke(referencesPrompt); // Replace with actual API call or logic
      const references = typeof referencesResponse === 'string' 
      ? referencesResponse 
      : referencesResponse?.text || JSON.stringify(referencesResponse);

      sections.push(` References\n${references}\n`);
  
   
      // Combine all sections into a single string
      const endOfBookContent = sections.join('\n');
      return endOfBookContent;
    } catch (error) {
      console.error('Error generating end-of-book content:', error);
      throw new Error('Failed to generate end-of-book content');
    }
  }

  private async generateFlowchart(promptText: string): Promise<string> {
    try {
      const flowchartPrompt = `
        Generate a valid Mermaid.js flowchart using this description:
        "${promptText}"
        Ensure the response starts with "graph TD" or "graph LR".
        Do not include any extra text, explanations, or markdown code blocks (e.g., do not wrap in \`\`\`mermaid ... \`\`\`).
      `;
      
      const response = await this.textModel.invoke(flowchartPrompt);
  
      let flowchartCode = typeof response === 'string' ? response : response?.content || '';
  
      flowchartCode = flowchartCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  
      if (!flowchartCode.includes('graph')) {
        throw new Error('Invalid Mermaid.js output from AI.');
      }
      if (flowchartCode.startsWith('graph TD') && !flowchartCode.startsWith('graph TD\n')) {
        flowchartCode = flowchartCode.replace('graph TD', 'graph TD\n');
      }
      // Similarly for graph LR if needed.
      
  
      const filePath = await this.saveFlowchartImage(flowchartCode, 'flowchart');
      return filePath;
    } catch (error) {
      this.logger.error(`Error generating flowchart: ${error.message}`);
      throw new Error('Failed to generate flowchart');
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
      await this.initializeAIModels(); // Ensure API keys are loaded before generating content

      const bookContent = await this.createBookContent(promptData);
      const coverImagePath = await this.generateBookCover(promptData);
      const backgroundImagePath = await this.generateBookBackgroundCover(promptData);

      const book = new BookGeneration();
      book.userId = userId;
      book.bookTitle = promptData.bookTitle;
      book.authorName = promptData.authorName;
      book.authorBio = promptData.authorBio;
      book.subtitle = promptData.subtitle;
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
        styling: promptData.advancedOptions.styling?? this.getDefaultStyling(),
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
  async searchBookQuery(userId: number, search: SearchDto) {
    try {
      // Prepare the query filter based on the provided search parameters
      const query:any = {userId};
  
      if (search.bookTitle) {
        query['bookTitle'] = { $regex: new RegExp(search.bookTitle, 'i') }; // case-insensitive search
      }
      if (search.genre) {
        query['genre'] = search.genre;
      }
      if (search.theme) {
        query['theme'] = search.theme;
      }
      if (search.language) {
        query['language'] = search.language;
      }
      if (search.targetAudience) {
        query['targetAudience'] = search.targetAudience;
      }
      if (search.numberOfPages) {
        query['numberOfPages'] = search.numberOfPages;
      }
  
      // Optional: If 'isFlowChart' or 'isDiagram' is provided, filter by them
      if (search.isFlowChart !== undefined) {
        query['isFlowChart'] = search.isFlowChart;
      }
      if (search.isDiagram !== undefined) {
        query['isDiagram'] = search.isDiagram;
      }
  
      // Execute the search query to find matching books
      const books = await this.bookGenerationRepository.find(query);
  
      if (!books || books.length === 0) {
        throw new Error('No books found based on the search criteria.');
      }
  
      return books;
    } catch (error) {
      this.logger.error(`Error during book search: ${error.message}`);
      throw new Error('Failed to search books.');
    }
  }
  
}


