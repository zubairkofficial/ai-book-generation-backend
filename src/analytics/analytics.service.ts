import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AnalyticsService {
constructor(
    private readonly userService: UsersService,      
  ) {}

 async getAllUserAnalytics() {
   return await this.userService.getUserWithBookInfo()
  }
}
