import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';


export enum AiAssistantType {
  BOOK_IDEA = "book_idea",
  BOOK_COVER_IMAGE = "book_cover_image",
  WRITING_ASSISTANT = "writing_assistant",
}

@Entity()
export class AiAssistant extends BaseEntity {
  
  @ManyToOne(() => User, (user) => user.aiAssistants, { onDelete: 'CASCADE' }) 
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: "enum",
    enum: AiAssistantType,
    nullable: false,
  })
  type: AiAssistantType; // AI Task Type using Enum

  @Column('jsonb', { nullable: true })
  information?: Record<string, any>; // Store dynamic data related to AI task

  @Column('jsonb', { nullable: true })
  response?: {
    generatedText?: string;
    imageUrls?: string[];
    timestamp?: Date;
  };
}
