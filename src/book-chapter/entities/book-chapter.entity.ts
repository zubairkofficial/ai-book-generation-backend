import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column,  ManyToOne, JoinColumn } from 'typeorm';



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
  

}
