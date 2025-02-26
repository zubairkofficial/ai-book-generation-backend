import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role } from 'src/utils/roles.enum';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard) // First authenticate, then check role
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @Roles(Role.ADMIN)
  async getKeys() {
    return await this.apiKeysService.getApiKeys();
  }

  @Put()
  @Roles(Role.ADMIN)
  async updateKeys(@Body() input: UpdateApiKeyDto) {
    return await this.apiKeysService.updateApiKeys(input);
  }
}
