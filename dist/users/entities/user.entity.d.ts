import { BaseEntity } from 'src/common/entities/base.entity';
export declare class User extends BaseEntity {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    isEmailVerified: boolean;
    twoFactorSecret: string;
}
