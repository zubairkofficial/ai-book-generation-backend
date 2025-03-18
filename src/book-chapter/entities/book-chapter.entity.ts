import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column,  ManyToOne, JoinColumn, OneToOne } from 'typeorm';



@Entity()
export class BookChapter extends BaseEntity {

  @ManyToOne(() => BookGeneration, (bookGeneration) => bookGeneration.bookChapter,{ onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookGenerationId' })
  bookGeneration: BookGeneration;

  @Column({ nullable: true, type: 'int' })
  minWords?: number;

  @Column({ nullable: true, type: 'int' })
  maxWords?: number;

  @Column({ nullable: true, type: 'int' })
  chapterNo?: number;

  @Column('jsonb', { nullable: true })
  chapterInfo?:  string;
  
  @Column('text', { nullable: true })
  chapterSummary?: string; // Store summary as plain text or JSON based on your use case
  
  @Column('text', { nullable: true })
  chapterName?: string; // Store summary as plain text or JSON based on your use case
  



}
