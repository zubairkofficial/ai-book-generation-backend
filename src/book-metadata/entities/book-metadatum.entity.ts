import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity()
export class BookMetadata {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BookGeneration, (bookGeneration) => bookGeneration.metadata)
  @JoinColumn({ name: 'bookGenerationId' })
  bookGeneration: BookGeneration;

  @Column({ nullable: true, type: 'int' })
  minCharacters?: number;

  @Column({ nullable: true, type: 'int' })
  maxCharacters?: number;

  @Column({ nullable: true, type: 'int' })
  chapterNo?: number;

  @Column('jsonb', { nullable: true })
  chapterInfo?: {  
    fullContent?: string;
  };
}
