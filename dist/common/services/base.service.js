"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const EntityNotFoundError_1 = require("typeorm/error/EntityNotFoundError");
let BaseService = class BaseService {
    constructor(repository) {
        this.repository = repository;
    }
    async getAll() {
        try {
            return await this.repository.find();
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Failed to fetch records');
        }
    }
    async getById(id) {
        try {
            const where = { id };
            const entity = await this.repository.findOne({ where });
            if (!entity) {
                throw new common_1.NotFoundException(`Entity with ID ${id} not found`);
            }
            return entity;
        }
        catch (error) {
            if (error instanceof EntityNotFoundError_1.EntityNotFoundError) {
                throw new common_1.NotFoundException(error.message);
            }
            throw new common_1.InternalServerErrorException('Failed to fetch record');
        }
    }
    async create(data) {
        try {
            const entity = this.repository.create(data);
            return await this.repository.save(entity);
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw new common_1.BadRequestException(error.message);
            }
            throw new common_1.InternalServerErrorException('Failed to create record');
        }
    }
    async update(id, data) {
        try {
            const entity = await this.getById(id);
            Object.assign(entity, data);
            return await this.repository.save(entity);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw new common_1.NotFoundException(error.message);
            }
            throw new common_1.InternalServerErrorException('Failed to update record');
        }
    }
    async delete(id) {
        try {
            const entity = await this.getById(id);
            await this.repository.remove(entity);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw new common_1.NotFoundException(error.message);
            }
            throw new common_1.InternalServerErrorException('Failed to delete record');
        }
    }
};
exports.BaseService = BaseService;
exports.BaseService = BaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.Repository])
], BaseService);
//# sourceMappingURL=base.service.js.map