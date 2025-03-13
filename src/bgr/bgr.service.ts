// src/bgr/bgr.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bgr } from './entities/bgr.entity';
import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';

@Injectable()
export class BgrService {
  constructor(
    @InjectRepository(Bgr)
    private bgrRepository: Repository<Bgr>,
  ) {}

  // Method to create a Bgr entity
  async createBgr( glossary: string[], references: string[], index: string[], savedChapter: BookChapter, bookInfo: BookGeneration): Promise<Bgr> {
    try {
      
    
    // Create a new Bgr instance
    const bgr = new Bgr();
    bgr.glossary = glossary.join("\n"); // Store glossary as a string
    bgr.refrence = references.join("\n"); // Store references as a string
    bgr.index = index.join("\n"); // Store index as a string
    bgr.chapter = savedChapter; // Link the chapter to Bgr
    bgr.bookGeneration = bookInfo; // Link the bookGeneration to Bgr

    // Save the Bgr entity
    const savedBgr = await this.bgrRepository.save(bgr);

    // Return the saved Bgr
    return savedBgr;
  } catch (error) {
    throw new Error(error.message);
  }
  }
}
