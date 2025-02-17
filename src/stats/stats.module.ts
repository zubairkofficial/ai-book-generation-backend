import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { BookGenerationModule } from '../book-generation/book-generation.module'; // Import BookGenerationModule

@Module({
  controllers: [StatsController],
  providers: [StatsService],
  imports: [UsersModule, BookGenerationModule], // Add BookGenerationModule here
})
export class StatsModule {}
