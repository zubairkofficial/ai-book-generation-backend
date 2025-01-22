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
  private textModel: LangchainOpenAI; // For text generation
  private openai: OpenAI; // For DALL·E image generation
  private readonly logger = new Logger(BookGenerationService.name);
  private readonly uploadsDir: string;

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

    // Set up uploads directory
    this.uploadsDir = this.setupUploadsDirectory();
  }

  private setupUploadsDirectory(): string {
    // Get the root directory of the project
    const rootDir = process.cwd();
    
    // Create uploads path
    const uploadsPath = path.join(rootDir, 'uploads');

    // Create directories if they don't exist
    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      // Create subdirectories for different types of uploads
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
      // Create the full directory path
      const dirPath = path.join(this.uploadsDir, subDirectory);
      
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Create unique filename
      const timestamp = new Date().getTime();
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fullFileName = `${sanitizedFileName}_${timestamp}.png`;
      const filePath = path.join(dirPath, fullFileName);

      // Save the image
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

      this.logger.log(`Image saved successfully: ${filePath}`);
      
      // Return the relative path for database storage
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

      // Generate cover image using OpenAI
      const response = await this.openai.images.generate({
        prompt: coverImagePrompt,
        n: 1,
        size: imageSize,
        response_format: 'b64_json'
      });

      if (!response.data[0]?.b64_json) {
        throw new Error('No image data received from OpenAI');
      }

      // Save the generated image
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
      // Step 1: Enhanced professional book outline prompt
      const outlinePromptTemplate = new PromptTemplate({
        template: `
          You are a master storyteller and professional book author with expertise in multiple genres. Create a masterfully crafted book that meets professional publishing standards.

          BOOK PROJECT SPECIFICATIONS:
          Title: "{bookTitle}"
          Genre: {genre}
          Theme: {theme}
          Target Length: {numberOfPages} pages
          Chapter Structure: {numberOfChapters} chapters
          Target Audience: {targetAudience}
          Language & Style: {language}

          NARRATIVE ELEMENTS:
          Primary Characters: {characters}
          Setting Details: {setting}
          Narrative Tone: {tone}
          Plot Developments: {plotTwists}
          Additional Requirements: {additionalContent}

          PROFESSIONAL BOOK STRUCTURE:
          1. Front Matter
             - Title Page
             - Copyright Page
             - Dedication
             - Table of Contents
             - Foreword/Preface (if applicable)

          2. Main Content Structure
             - Introduction/Prologue
             - {numberOfChapters} Chapters
             - Epilogue/Conclusion
             - Appendices (if needed)

          3. Story Architecture
             - Three-Act Structure Implementation
             - Clear Story Arcs (Main Plot and Subplots)
             - Character Development Trajectories
             - Theme Integration Points
             - Plot Twist Placement
             - Pacing Guidelines

          4. Professional Writing Standards
             - Consistent POV and Tense
             - Scene Structure Guidelines
             - Dialogue Formatting
             - Paragraph Length Variation
             - Transition Techniques
             - Literary Device Usage

          5. Genre-Specific Requirements
             - {genre} Conventions
             - Target Audience Expectations
             - Market Standards
             - Reader Engagement Techniques

          DETAILED OUTLINE REQUIREMENTS:
          1. Executive Summary (2-3 paragraphs)
             - Core Premise
             - Main Story Arc
             - Unique Selling Points

          2. Chapter-by-Chapter Breakdown
             - Chapter Title
             - Chapter Purpose
             - Chapter Summary (300 words)
             - Key Scenes
             - Character Arcs
             - Theme Development
             - Plot Advancement
             - Emotional Beats

          3. Character Development Plan
             - Arc Progression
             - Key Moments
             - Relationship Dynamics
             - Growth Points

          4. Theme Integration Map
             - Core Theme: {theme}
             - Subthemes
             - Symbol System
             - Motif Placement

          5. Technical Specifications
             - Target Word Count per Chapter
             - Scene Distribution
             - Pacing Guidelines
             - Tension Graph

          FORMAT YOUR RESPONSE AS:
          1. Executive Summary
          2. Detailed Chapter Outline (with clear chapter titles and summaries)
          3. Story Arc Analysis
          4. Character Development Plan
          5. Theme Integration Details
          6. Technical Notes

          Each chapter entry should follow this format:
          Chapter [Number]: [Title]
          Summary: [Detailed chapter summary]
          Key Elements: [Plot points, character moments, themes]
        `,
        inputVariables: [
          'bookTitle', 'genre', 'theme', 'characters', 'setting', 'tone',
          'plotTwists', 'numberOfPages', 'numberOfChapters', 'targetAudience',
          'language', 'additionalContent'
        ],
      });

      // Step 2: Enhanced professional chapter generation prompt
      const chapterPromptTemplate = new PromptTemplate({
        template: `
          You are a professional novelist crafting Chapter {chapterNumber} of "{bookTitle}". Write with the expertise of a seasoned author while maintaining the highest literary standards.

          CHAPTER SPECIFICATIONS:
          Chapter Title: {chapterTitle}
          Chapter Summary: {chapterSummary}

          NARRATIVE CONTEXT:
          Genre: {genre}
          Theme: {theme}
          Setting: {setting}
          Tone: {tone}
          Key Characters: {characters}

          PROFESSIONAL WRITING REQUIREMENTS:
          1. Chapter Architecture
             - Strong Opening Hook
             - Clear Scene Structure
             - Proper Scene Transitions
             - Effective Chapter Resolution
             - Strategic Paragraph Breaks
             - Varied Sentence Structure
             - Professional Dialogue Attribution
             - Proper Scene Spacing

          2. Content Development
             - Deep POV Implementation
             - Show vs. Tell Balance
             - Sensory Detail Integration
             - Emotional Resonance
             - Character Voice Consistency
             - Setting Integration
             - Thematic Element Weaving
             - Subplot Development

          3. Technical Excellence
             - Professional Formatting
             - Consistent Tense Usage
             - Clear Point of View
             - Proper Paragraph Structure
             - Effective Dialogue Tags
             - Scene Break Indicators
             - Time Passage Markers
             - Transition Phrases

          4. Engagement Techniques
             - Tension Management
             - Pacing Variation
             - Emotional Hooks
             - Reader Investment
             - Suspense Building
             - Character Empathy
             - Scene Visualization
             - Narrative Flow

          FORMATTING GUIDELINES:
          - Implement standard dialogue formatting
          - Include chapter title and number
          - Use professional paragraph spacing
          - Mark POV shifts clearly
          - Indicate time jumps appropriately

          Write this chapter maintaining professional publishing standards while ensuring engaging storytelling.
        `,
        inputVariables: [
          'chapterNumber', 'bookTitle', 'chapterTitle', 'chapterSummary',
          'genre', 'theme', 'characters', 'setting', 'tone', 'plotTwists',
          'targetAudience', 'language', 'numberOfPages'
        ],
      });

      // Step 3: Professional introduction prompt
      const introductionPrompt = new PromptTemplate({
        template: `
          As a professional author, craft a compelling introduction for "{bookTitle}" that meets publishing standards.

          INTRODUCTION REQUIREMENTS:
          1. Opening Elements
             - Create an unforgettable hook
             - Establish unique voice and tone
             - Set genre expectations
             - Introduce central conflict/premise

          2. Technical Requirements
             - Professional prose quality
             - Clear narrative focus
             - Appropriate pacing
             - Engaging writing style

          3. Story Foundation
             - Establish story world
             - Hint at themes
             - Create reader investment
             - Set narrative expectations

          CONTEXT:
          Genre: {genre}
          Theme: {theme}
          Target Audience: {targetAudience}
          Tone: Professional, engaging, appropriate for {genre}

          Create an introduction that compels readers to continue while maintaining professional literary standards.
        `,
        inputVariables: ['bookTitle', 'genre', 'theme', 'targetAudience']
      });

      // Step 4: Professional conclusion prompt
      const conclusionPrompt = new PromptTemplate({
        template: `
          As a professional author, craft a satisfying conclusion for "{bookTitle}" that meets publishing standards.

          CONCLUSION REQUIREMENTS:
          1. Resolution Elements
             - Resolve main conflicts
             - Complete character arcs
             - Address major themes
             - Provide emotional satisfaction

          2. Technical Requirements
             - Maintain professional prose
             - Proper pacing
             - Effective closure
             - Memorable final impressions

          3. Story Completion
             - Tie up major plot threads
             - Resolve character journeys
             - Reinforce themes
             - Leave appropriate questions (if series)

          CONTEXT:
          Genre: {genre}
          Theme: {theme}
          Target Audience: {targetAudience}
          Tone: Professional, satisfying, appropriate for {genre}

          Create a conclusion that satisfies readers while maintaining professional literary standards.
        `,
        inputVariables: ['bookTitle', 'genre', 'theme', 'targetAudience']
      });

      // Merge default styling with provided styling
      const defaultStyling = this.getDefaultStyling();
      const styling = promptData.advancedOptions?.styling ? {
        ...defaultStyling,
        ...promptData.advancedOptions.styling,
        fontSize: { ...defaultStyling.fontSize, ...promptData.advancedOptions.styling.fontSize },
        fontFamily: { ...defaultStyling.fontFamily, ...promptData.advancedOptions.styling.fontFamily },
        lineHeight: { ...defaultStyling.lineHeight, ...promptData.advancedOptions.styling.lineHeight },
        textAlignment: { ...defaultStyling.textAlignment, ...promptData.advancedOptions.styling.textAlignment },
        margins: { ...defaultStyling.margins, ...promptData.advancedOptions.styling.margins },
        spacing: { ...defaultStyling.spacing, ...promptData.advancedOptions.styling.spacing },
        pageLayout: { ...defaultStyling.pageLayout, ...promptData.advancedOptions.styling.pageLayout },
      } : defaultStyling;

      // Generate book outline first
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
        additionalContent: promptData.additionalContent || '',
      });

      const bookOutline = await this.textModel.invoke(formattedOutlinePrompt);
  
      // Build the complete book content with styling
      let fullBookContent = '';
  
      // Add title page with styling
      fullBookContent += `<title-page style="
        font-size: ${styling.fontSize.title};
        font-family: ${styling.fontFamily.title};
        line-height: ${styling.lineHeight.title};
        text-align: ${styling.textAlignment.title};
        margin-top: ${styling.margins.top};
        margin-bottom: ${styling.margins.bottom};
        margin-left: ${styling.margins.left};
        margin-right: ${styling.margins.right};">
${promptData.bookTitle}
</title-page>

<new-page>`;
  
      // Generate and add introduction with styling
      const formattedIntroductionPrompt = await introductionPrompt.format({
        bookTitle: promptData.bookTitle,
        genre: promptData.genre,
        theme: promptData.theme,
        targetAudience: promptData.targetAudience,
      });
  
      const introductionContent = await this.textModel.invoke(formattedIntroductionPrompt);
      fullBookContent += `<section-heading style="
        font-size: ${styling.fontSize.headers};
        font-family: ${styling.fontFamily.headers};
        line-height: ${styling.lineHeight.headers};
        text-align: ${styling.textAlignment.headers};
        margin-bottom: ${styling.spacing.sectionSpacing};">Introduction</section-heading>

<content style="
        font-size: ${styling.fontSize.body};
        font-family: ${styling.fontFamily.body};
        line-height: ${styling.lineHeight.body};
        text-align: ${styling.textAlignment.body};
        margin-bottom: ${styling.spacing.paragraphSpacing};">
${introductionContent}
</content>

<new-page>`;
  
      // Generate chapters with styling
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
          numberOfPages: promptData.numberOfPages,
        });
  
        const chapterContent = await this.textModel.invoke(formattedChapterPrompt);
        
        fullBookContent += `<new-page>
<chapter-heading style="
        font-size: ${styling.fontSize.chapterTitle};
        font-family: ${styling.fontFamily.chapterTitle};
        line-height: ${styling.lineHeight.chapterTitle};
        text-align: ${styling.textAlignment.chapterTitle};
        margin-bottom: ${styling.spacing.chapterSpacing};">Chapter ${index + 1}: ${chapterTitle}</chapter-heading>

<content style="
        font-size: ${styling.fontSize.body};
        font-family: ${styling.fontFamily.body};
        line-height: ${styling.lineHeight.body};
        text-align: ${styling.textAlignment.body};
        margin-bottom: ${styling.spacing.paragraphSpacing};">
${chapterContent.replace(/###/g, '<scene-break style="margin: 2em 0; text-align: center;">')}
</content>

`;
      }
  
      // Generate conclusion with styling
      const formattedConclusionPrompt = await conclusionPrompt.format({
        bookTitle: promptData.bookTitle,
        genre: promptData.genre,
        theme: promptData.theme,
        targetAudience: promptData.targetAudience,
      });
  
      const conclusionContent = await this.textModel.invoke(formattedConclusionPrompt);
      fullBookContent += `<new-page>
<section-heading style="
        font-size: ${styling.fontSize.headers};
        font-family: ${styling.fontFamily.headers};
        line-height: ${styling.lineHeight.headers};
        text-align: ${styling.textAlignment.headers};
        margin-bottom: ${styling.spacing.sectionSpacing};">Conclusion</section-heading>

<content style="
        font-size: ${styling.fontSize.body};
        font-family: ${styling.fontFamily.body};
        line-height: ${styling.lineHeight.body};
        text-align: ${styling.textAlignment.body};
        margin-bottom: ${styling.spacing.paragraphSpacing};">
${conclusionContent}
</content>`;
  
      return fullBookContent;

    } catch (error) {
      this.logger.error(`Error generating book content: ${error.message}`, error.stack);
      throw new Error('Failed to generate book content. Please try again.');
    }
  }
  async getAllBooksByUser(userId: number): Promise<BookGeneration[]> {
    return await this.bookGenerationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' }, // Sort by createdAt in descending order
    });
  }

  async generateAndSaveBook(userId: number, promptData: BookGenerationDto): Promise<BookGeneration> {
    try {
      // Generate book content
      const bookContent = await this.createBookContent(promptData);

      // Generate book cover
      const coverImagePath = await this.generateBookCover(promptData);

      // Create book entity
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
        styling: promptData.advancedOptions?.styling || this.getDefaultStyling(),
        fullContent: bookContent
      };

      // Save to database
      const savedBook = await this.bookGenerationRepository.save(book);
      this.logger.log(`Book saved successfully for user ${userId}: ${promptData.bookTitle}`);

      return savedBook;
    } catch (error) {
      this.logger.error(`Error generating and saving book: ${error.message}`);
      throw new Error('Failed to generate and save book');
    }
  }
}