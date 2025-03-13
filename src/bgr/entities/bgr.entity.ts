import { BookChapter } from "src/book-chapter/entities/book-chapter.entity";
import { BookGeneration } from "src/book-generation/entities/book-generation.entity";
import { BaseEntity } from "src/common/entities/base.entity";
import { Entity, Column, ManyToOne, JoinColumn, OneToOne } from "typeorm";

@Entity()
export class Bgr extends BaseEntity {
  
  @Column({ type: "text", nullable: true })
  glossary: string;
  
  @Column({ type: "text", nullable: true })
  index: string;
  
  @Column({ type: "text", nullable: true })
  refrence: string;
  

  // One-to-One relationship with BookChapter
  @OneToOne(() => BookChapter, (bookChapter) => bookChapter.bgr, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "chapterId" })
  chapter: BookChapter;

  // Many-to-One relationship with BookGeneration
  @ManyToOne(() => BookGeneration, (bookGeneration) => bookGeneration.bookChapter, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "bookGenerationId" })
  bookGeneration: BookGeneration;
}
