import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { BookGenerationModule } from '../book-generation/book-generation.module'; // Import BookGenerationModule
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookGeneration } from 'src/book-generation/entities/book-generation.entity';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
  imports: [UsersModule, BookGenerationModule,
    TypeOrmModule.forFeature([BookGeneration]),
  ], // Add BookGenerationModule here
})
export class StatsModule {}
