import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { User } from 'src/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // Import email service module
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {} 