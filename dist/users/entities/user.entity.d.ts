import { BaseEntity } from 'src/common/entities/base.entity';
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin"
}
export declare class User extends BaseEntity {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    isEmailVerified: boolean;
    twoFactorSecret: string;
    role: UserRole;
}
