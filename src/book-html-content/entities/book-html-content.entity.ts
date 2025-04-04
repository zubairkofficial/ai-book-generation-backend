// src/book-html-content/entities/book-html-content.entity.ts
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';

@Entity()
export class BookHtmlContent extends BaseEntity {
  @OneToOne(() => BookGeneration)
  @JoinColumn({ name: 'bookId' })
  book: BookGeneration;

  @Column({ type: 'text', nullable: true })
  glossaryHtml: string;

  @Column({ type: 'text', nullable: true })
  indexHtml: string;

  @Column({ type: 'text', nullable: true })
  referencesHtml: string;

  @Column('jsonb', { nullable: true })
  additionalHtml: {
    tableOfContents?: string;
    dedication?: string;
    preface?: string;
    introduction?: string;
  };

  @Column('jsonb', { nullable: true })
  chaptersHtml: Array<{
    chapterNo: number;
    chapterName: string;
    contentHtml: string;
  }>;
}