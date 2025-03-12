import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BgrService } from './bgr.service';
import { CreateBgrDto } from './dto/create-bgr.dto';
import { UpdateBgrDto } from './dto/update-bgr.dto';

@Controller('bgr')
export class BgrController {
  constructor(private readonly bgrService: BgrService) {}

  @Post()
  create(@Body() createBgrDto: CreateBgrDto) {
    return this.bgrService.create(createBgrDto);
  }

  @Get()
  findAll() {
    return this.bgrService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bgrService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBgrDto: UpdateBgrDto) {
    return this.bgrService.update(+id, updateBgrDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bgrService.remove(+id);
  }
}
