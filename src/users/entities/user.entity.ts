import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column } from 'typeorm';

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
}
