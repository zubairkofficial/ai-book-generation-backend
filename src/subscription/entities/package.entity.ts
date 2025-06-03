import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';

@Entity()
export class Package extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ type: 'int' })
  tokenLimit: number;

  @Column({ type: 'int' })
  imageLimit: number;

  @Column({ length: 50, nullable: true })
  modelType: string;  // e.g., 'gpt-4', 'gpt-3.5-turbo', etc.

  @Column({ length: 50, nullable: true }) 
  imageModelType: string;  // The fal.ai model to use

  @Column({  nullable: true }) 
  imageModelURL: string;  

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFree: boolean;

  @Column('jsonb', { nullable: true })
  features: Record<string, any>;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;
} 