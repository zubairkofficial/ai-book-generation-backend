import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AnalyticsService {
constructor(
    private readonly userService: UsersService,      
  ) {}

 async getAllUserAnalytics(userId) {
   return await this.userService.getUserWithBookInfo(userId)
  }
}
