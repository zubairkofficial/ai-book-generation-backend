import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DeepPartial } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';

@Injectable()
export class BaseService<T extends { id: number }> {
  constructor(private readonly repository: Repository<T>) {}

  async getAll(): Promise<T[]> {
    try {
      return await this.repository.find();
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch records');
    }
  }

  async getById(id: number): Promise<T> {
    try {
      const where: FindOptionsWhere<T> = { id } as FindOptionsWhere<T>;
      const entity = await this.repository.findOne({ where });
      if (!entity) {
        throw new NotFoundException(`Entity with ID ${id} not found`);
      }
      return entity;
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException('Failed to fetch record');
    }
  }

  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Failed to create record');
    }
  }

  async update(id: number, data: DeepPartial<T>): Promise<T> {
    try {
      const entity = await this.getById(id);
      Object.assign(entity, data);
      return await this.repository.save(entity);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException('Failed to update record');
    }
  }

  async delete(id: number): Promise<void> {
    try {
      const entity = await this.getById(id);
      await this.repository.remove(entity);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException('Failed to delete record');
    }
  }
}