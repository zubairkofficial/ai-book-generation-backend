import {
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
  } from 'typeorm';
  
  export abstract class BaseEntity {
    @PrimaryGeneratedColumn('increment') // Auto-generates a number for the primary key
    id: number;
  
    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) // Created at timestamp
    createdAt: Date;
  
    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) // Updated at timestamp
    updatedAt: Date;
  
    @DeleteDateColumn({ type: 'timestamp', nullable: true }) // Soft deletion timestamp
    deletedAt: Date;
  }