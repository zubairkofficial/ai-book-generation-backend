import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class BookGeneration extends BaseEntity {

  @Column()
  userId: number;

  @Column()
  bookTitle: string;

  @Column({ nullable: true })
  subtitle?: string;

  @Column()
  genre: string;

  @Column()
  theme: string;

  @Column({ nullable: true })
  characters?: string;

  @Column({ nullable: true })
  setting?: string;

  @Column({nullable: true })
  authorName?: string;

  @Column({ nullable: true })
  authorBio?: string;

  @Column()
  tone: string;

  @Column({ nullable: true })
  plotTwists?: string;

  @Column('int')
  numberOfPages: number;

  @Column('int')
  numberOfChapters: number;

  @Column()
  targetAudience: string;

  @Column()
  language: string;

  @Column({type: 'boolean', default:false})
  isFlowChart: boolean;

  @Column({type: 'boolean', default:false})
  isDiagram: boolean;

  @Column({ type: 'text', nullable: true })
  additionalContent?: string;

  // Add the `additionalData` column as JSONB
  @Column('jsonb', { nullable: true })
  additionalData?: {
    coverImageUrl?: string;
    styling?: object;
    fullContent?: string;
    backCoverImageUrl?: string;
  };

 
}
