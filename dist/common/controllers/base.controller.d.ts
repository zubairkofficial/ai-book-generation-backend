import { BaseService } from '../services/base.service';
import { DeepPartial } from 'typeorm';
export declare class BaseController<T extends {
    id: number;
}> {
    private readonly baseService;
    constructor(baseService: BaseService<T>);
    getAll(): Promise<T[]>;
    getById(id: number): Promise<T>;
    create(data: DeepPartial<T>): Promise<T>;
    update(id: number, data: DeepPartial<T>): Promise<T>;
    delete(id: number): Promise<void>;
}
