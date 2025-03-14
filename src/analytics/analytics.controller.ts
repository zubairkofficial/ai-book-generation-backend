import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}


  @UseGuards(JwtAuthGuard)
  @Get('/admin')
  getAllUserAnalytics() {
    return this.analyticsService.getAllUserAnalytics();
  }
}
