import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role } from 'src/utils/roles.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}


 
  @Roles(Role.ADMIN)
  @Get('/admin')
  getAllUserAnalytics(@Req() request) {
    const userId = request.user?.id;
    return this.analyticsService.getAllUserAnalytics(userId);
  }
}
