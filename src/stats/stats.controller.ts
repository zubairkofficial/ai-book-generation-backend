import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { StatsService } from './stats.service';
import { CreateStatDto } from './dto/create-stat.dto';
import { UpdateStatDto } from './dto/update-stat.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/request-with-user.interface';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post()
  create(@Body() createStatDto: CreateStatDto) {
    return this.statsService.create(createStatDto);
  }


  @Get()
  getAllStats( @Req() request: RequestWithUser) {
    const user = request.user;
    return this.statsService.getAllStats(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.statsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStatDto: UpdateStatDto) {
    return this.statsService.update(+id, updateStatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.statsService.remove(+id);
  }
}
