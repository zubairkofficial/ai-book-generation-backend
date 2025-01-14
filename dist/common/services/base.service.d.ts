import { Repository, DeepPartial } from 'typeorm';
export declare class BaseService<T extends {
    id: number;
}> {
    private readonly repository;
    constructor(repository: Repository<T>);
    getAll(): Promise<T[]>;
    getById(id: number): Promise<T>;
    create(data: DeepPartial<T>): Promise<T>;
    update(id: number, data: DeepPartial<T>): Promise<T>;
    delete(id: number): Promise<void>;
}
