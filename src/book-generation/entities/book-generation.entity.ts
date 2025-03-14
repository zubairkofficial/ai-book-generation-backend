import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column,  OneToMany } from 'typeorm';

export enum BookType {
  COMPLETE = 'complete',
  INCOMPLETE = 'incomplete',
}
@Entity()
export class BookGeneration extends BaseEntity {

  @Column()
  userId: number;

  @Column()
  bookTitle: string;


  @Column()
  genre: string;


  @Column({ nullable: true })
  characters?: string;

  @Column({  nullable: true })
  numberOfChapters?: number;


  @Column({nullable: true })
  ideaCore?: string;

  @Column({nullable: true })
  authorName?: string;

  @Column({ nullable: true })
  authorBio?: string;

  @Column()
  targetAudience: string;

  @Column()
  language: string;


  @Column({ type: 'text', nullable: true })
  additionalContent?: string;

  // Add the `additionalData` column as JSONB
  @Column('jsonb', { nullable: true })
  additionalData?: {
    coverImageUrl?: string;
    styling?: object;
    fullContent?: string;
    backCoverImageUrl?: string;
    tableOfContents?: string;
    coverPageResponse?: string,
    dedication?: string,
    preface?: string,
    introduction?: string,
   
  };


  @Column({
    type: 'enum',
    enum: BookType,
    default: BookType.INCOMPLETE,
  })
  type: BookType;

  @OneToMany(() => BookChapter, (bookChapter) => bookChapter.bookGeneration, { onDelete: 'CASCADE' })
  bookChapter: BookChapter[];
 
  @Column({ type: "text", nullable: true })
  glossary: string;
  
  @Column({ type: "text", nullable: true })
  index: string;
  
  @Column({ type: "text", nullable: true })
  reference: string;
}
