import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  Req, 
  Query, 
  ParseBoolPipe, 
  DefaultValuePipe, 
  Put
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';
import { SubscriptionService } from './subscription.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { SubscribePackageDto } from './dto/subscribe-package.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role } from 'src/utils/roles.enum';
import { UpdatePackageDto } from './dto/update-package.dto';

@ApiTags('subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ADMIN: Create a new package
  @Post('packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new subscription package (Admin only)' })
  @ApiResponse({ status: 201, description: 'Package created successfully' })
  async createPackage( @Req() request: RequestWithUser, @Body() createPackageDto: CreatePackageDto) {
    const userId = request.user.id;
    return this.subscriptionService.createPackage(+userId,createPackageDto);
  }

  // Get all available packages
  @Get('packages')
  @ApiOperation({ summary: 'Get all active subscription packages' })
  @ApiResponse({ status: 200, description: 'Returns all active packages' })
  async getAllPackages(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean
  ) {
    return this.subscriptionService.getAllPackages(includeInactive);
  }

  // USER: Subscribe to a package
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Subscribe to a package' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async subscribeToPackage(
    @Req() request: RequestWithUser,
    @Body() subscribeDto: SubscribePackageDto
  ) {
    const userId = request.user.id;
    return this.subscriptionService.subscribeToPackage(userId, subscribeDto);
  }
  @Post('unsubscribe/:id')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Subscribe to a package' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async unSubscribeToPackage(
    @Req() request: RequestWithUser,
    @Param("id") id:number
  
  ) {
    const userId = request.user.id;
    return this.subscriptionService.unSubscribeToPackage(id,userId);
  }

  // USER: Get current subscription info
  @Get('my-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user\'s active subscription details' })
  @ApiResponse({ status: 200, description: 'Returns active subscription details' })
  async getMySubscription(@Req() request: RequestWithUser) {
    const userId = request.user.id;
    return this.subscriptionService.getUserUsage(userId);
  }

  @Put('packages/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Update a subscription package (Admin only)' })
@ApiResponse({ status: 200, description: 'Package updated successfully' })
async updatePackage(
  @Param('id') id: number,
  @Req() request: RequestWithUser,
  @Body() updatePackageDto: UpdatePackageDto
) {
  const userId = request.user.id;
  return this.subscriptionService.updatePackage(+id, +userId, updatePackageDto);
}
} 