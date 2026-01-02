import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/user.entity';

@Entity()
export class Settings extends BaseEntity {
  @Column({ nullable: true })
  coverImagePrompt: string;

  @Column({ nullable: true })
  coverImageModel: string;

  @Column({ nullable: true })
  coverImageDomainUrl: string;

  @Column({ nullable: true })
  chapterImagePrompt: string;

  @Column({ nullable: true })
  chapterImageModel: string;

  @Column({ nullable: true })
  chapterImageDomainUrl: string;

  @Column({ type: 'text', nullable: true })
  bookIdeaMasterPrompt: string;

  @Column({ type: 'text', nullable: true })
  bookCoverMasterPrompt: string;

  @Column({ type: 'text', nullable: true })
  writingAssistantMasterPrompt: string;

  @Column({ type: 'text', nullable: true })
  chapterSummaryMasterPrompt: string;

  @Column({ type: 'text', nullable: true })
  presentationSlidesMasterPrompt: string;

  @Column()
  userID: number;

  @Column({ type: 'int', default: 1 })
  creditsPerModelToken: number;

  @Column({ type: 'int', default: 1 })
  creditsPerImageToken: number;

  @Column({ default: true })
  emailVerificationEnabled: boolean;

  @OneToOne(() => User, (user) => user.settings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: 'userID' })
  user: User;
}
