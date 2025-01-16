import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class BookGeneration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  bookTitle: string;

  @Column()
  genre: string;

  @Column()
  theme: string;

  @Column({ nullable: true })
  characters: string;

  @Column({ nullable: true })
  setting: string;

  @Column()
  tone: string;

  @Column({ nullable: true })
  plotTwists: string;

  @Column('int')
  numberOfPages: number;

  @Column('int')
  numberOfChapters: number;

  @Column()
  targetAudience: string;

  @Column()
  language: string;

  @Column({ type: 'text', nullable: true })
  additionalContent: string;

  @Column('jsonb', { nullable: true })
  additionalData: object;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
