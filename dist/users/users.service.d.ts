import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    findById(id: number): Promise<User>;
    findByEmail(email: string): Promise<User>;
    create(userData: Partial<User>): Promise<User>;
    updatePassword(id: number, newPassword: string): Promise<void>;
    update(id: number, updateData: Partial<User>): Promise<void>;
    markEmailAsVerified(id: number): Promise<void>;
}
