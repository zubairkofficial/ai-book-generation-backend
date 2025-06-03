import { AiAssistant } from 'src/ai-assistant/entities/ai-assistant.entity';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';
import { CardPayment } from 'src/card-payment/entities/card-payment.entity';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Settings } from 'src/settings/entities/settings.entity';
import { UserSubscription } from 'src/subscription/entities/user-subscription.entity';
import { Entity, Column, OneToMany, OneToOne } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity() // Marks this class as an entity
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100, nullable: false }) // Name column
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false }) // Email column (unique)
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: false }) // Password column
  password: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true }) // Phone number column (unique, optional)
  phoneNumber: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  availableAmount: number;

  @Column({ type: 'boolean', default: true })
  isNewUser: boolean;

  // @Column({ type: 'boolean', default: false })
  // fullModelAccess: boolean;
  
  @OneToMany(() => AiAssistant, (aiAssistant) => aiAssistant.user, { cascade: true })
  aiAssistants: AiAssistant[];

  @OneToMany(() => BookGeneration, (bookGeneration) => bookGeneration.user)
  bookGenerations: BookGeneration[];
  
  @OneToMany(() => UserSubscription, (userSubscription) => userSubscription.user)
  userSubscription: UserSubscription[];
  
  @OneToMany(() => CardPayment, (cardPayment) => cardPayment.user)
  cardPayment: CardPayment[];

  @OneToOne(() => Settings, (settings) => settings.user)
  settings: Settings
}