import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { TokenConversionDto } from './dto/token-conversion.dto';
import { Settings } from './entities/settings.entity';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role } from 'src/utils/roles.enum';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  async saveOrUpdate(@Body() settingsDto: UpdateSettingsDto, @GetUser() user: { id: number }): Promise<Settings> {
    // Get current user ID from request (assuming authentication middleware adds user info)
    const userId = user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.settingsService.createOrUpdate(userId, settingsDto);
  }

  @Roles(Role.USER,Role.ADMIN)
  @Get('token-conversion')
  async getTokenConversionSettings() {
    return this.settingsService.getTokenConversionSettings();
  }

  @Post('token-conversion')
  async updateTokenConversionSettings(@Body() dto: TokenConversionDto) {
    return this.settingsService.updateTokenConversionSettings(dto);
  }
}
