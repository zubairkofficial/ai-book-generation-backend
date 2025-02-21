import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column,  OneToMany } from 'typeorm';

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
  };

  @OneToMany(() => BookChapter, (bookChapter) => bookChapter.bookGeneration)
  bookChapter: BookChapter[];
 
}
