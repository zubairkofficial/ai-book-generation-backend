// users.controller.ts
import { Controller, Get, Patch, UseGuards, NotFoundException, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/users.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user\'s profile',
    type: User,
  })
  async getProfile(@GetUser() userPayload: { id: string }) {
    const user = await this.usersService.getProfile(+userPayload.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user\'s profile',
    type: User,
  })
  async getProfileByStats(@GetUser() userPayload: { id: string }) {
    const user = await this.usersService.getProfileByStats(+userPayload.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated user profile',
    type: User,
  })
  async updateProfile(
    @GetUser() userPayload: { id: string },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.updateUser(+userPayload.id, updateUserDto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}