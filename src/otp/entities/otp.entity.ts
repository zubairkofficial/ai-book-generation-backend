import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('otp')
  export class Otp {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column()
    email: string; // Or userId if tied to a user
  
    @Column()
    code: string; // The OTP code
  
    @Column()
    expiresAt: Date; // Expiration time
  
    @Column({ default: false })
    isUsed: boolean; // Whether the OTP has been used
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  