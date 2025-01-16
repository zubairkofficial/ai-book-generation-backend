import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class RolesGuard implements CanActivate {
    constructor();
    private reflector;
    canActivate(context: ExecutionContext): Promise<boolean>;
}
