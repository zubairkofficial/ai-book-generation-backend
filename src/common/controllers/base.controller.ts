import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
  } from '@nestjs/common';
  import { BaseService } from '../services/base.service';
  import { DeepPartial } from 'typeorm';
  
  @Controller()
  export class BaseController<T extends { id: number }> {
    constructor(private readonly baseService: BaseService<T>) {}
  
    @Get()
    async getAll(): Promise<T[]> {
      try {
        return await this.baseService.getAll();
      } catch (error) {
        throw new InternalServerErrorException('Failed to fetch records');
      }
    }
  
    @Get(':id')
    async getById(@Param('id') id: number): Promise<T> {
      try {
        return await this.baseService.getById(id);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(error.message);
        }
        throw new InternalServerErrorException('Failed to fetch record');
      }
    }
  
    @Post()
    async create(@Body() data: DeepPartial<T>): Promise<T> {
      try {
        return await this.baseService.create(data);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(error.message);
        }
        throw new InternalServerErrorException('Failed to create record');
      }
    }
  
    @Put(':id')
    async update(@Param('id') id: number, @Body() data: DeepPartial<T>): Promise<T> {
      try {
        return await this.baseService.update(id, data);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(error.message);
        }
        throw new InternalServerErrorException('Failed to update record');
      }
    }
  
    @Delete(':id')
    async delete(@Param('id') id: number): Promise<void> {
      try {
        return await this.baseService.delete(id);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(error.message);
        }
        throw new InternalServerErrorException('Failed to delete record');
      }
    }
  }