import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly uploadsDir: string;

  constructor(private configService: ConfigService) {
    this.uploadsDir = this.setupUploadsDirectory();
  }

  private setupUploadsDirectory(): string {
    const rootDir = process.cwd();
    const uploadsPath = path.join(rootDir, 'uploads');

    try {
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      const directories = ['covers', 'chapters', 'temp', 'graphs'];
      directories.forEach((dir) => {
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

  async generateImage(
    modelUrl: string, 
    apiKey: string, 
    prompt: string, 
    options: any = {}
  ): Promise<string> {
    try {
      const defaultOptions = {
        num_images: 1,
        enable_safety_checker: true,
        safety_tolerance: '2',
        output_format: 'jpeg',
        aspect_ratio: '9:16',
        raw: false,
      };

      const requestData = {
        prompt,
        ...defaultOptions,
        ...options,
      };

      const response = await axios.post(
        modelUrl,
        requestData,
        {
          headers: {
            Authorization: `Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.response_url;
    } catch (error) {
      this.logger.error(`Error generating image: ${error.message}`);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  async pollAndSaveImage(
    responseUrl: string, 
    apiKey: string, 
    fileName: string, 
    subDirectory: string = 'covers'
  ): Promise<string> {
    try {
      const maxRetries = 12;
      const delayMs = 10000; // 10 seconds between retries

      let imageUrl: string | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const getResponse = await axios.get(responseUrl, {
            headers: {
              Authorization: `Key ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (getResponse.data.images?.length > 0) {
            imageUrl = getResponse.data.images[0].url;
            break;
          }
        } catch (error) {
          this.logger.warn(`⏳ Image not ready (Attempt ${attempt}/${maxRetries})`);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (!imageUrl) {
        throw new Error('❌ Image generation failed after retries.');
      }

      // Download & Save Image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      const sanitizedFileName = fileName
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      const fullFileName = `${sanitizedFileName}_${Date.now()}.png`;
      const imagePath = path.join(this.uploadsDir, subDirectory, fullFileName);

      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
      fs.writeFileSync(imagePath, imageResponse.data);

      const baseUrl = this.configService.get<string>('BASE_URL');
      return `${baseUrl}/uploads/${subDirectory}/${fullFileName}`;
    } catch (error) {
      this.logger.error(`❌ Error processing image: ${error.message}`);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
} 