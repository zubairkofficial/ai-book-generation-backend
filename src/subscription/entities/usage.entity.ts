import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';
import { UserSubscription } from './user-subscription.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BookChapter } from 'src/book-chapter/entities/book-chapter.entity';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';

export enum UsageType {
  TOKEN = 'token',
  IMAGE = 'image',
}

@Entity()
export class Usage extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => UserSubscription, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: UserSubscription;


  @ManyToOne(() => BookGeneration, { nullable: true })
  @JoinColumn({ name: 'bookGenerationId' })
  bookGeneration?: BookGeneration; // Relation to BookGeneration

  @ManyToOne(() => BookChapter, { nullable: true })
  @JoinColumn({ name: 'bookChapterId' })
  bookChapter?: BookChapter; // Relation to BookChapter

  
  @Column({
    type: 'enum',
    enum: UsageType,
  })
  type: UsageType;

  @Column({ length: 100 })
  resource: string; // e.g. 'book-generation', 'chapter-creation', 'image-generation'

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
} 