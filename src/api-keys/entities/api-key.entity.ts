import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('api_keys')
export class ApiKey extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  openai_key: string;

  @Column()
  dalle_key: string;

  @Column()
  model: string;
}
