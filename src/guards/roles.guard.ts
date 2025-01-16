// src/guards/roles.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../utils/roles.enum';


export class RolesGuard implements CanActivate {
  constructor() { }

  private reflector = new Reflector();
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<Role[]>(ROLES_KEY, context.getHandler()); // Get roles metadata
    if (!roles) {
      return true; // If no roles are defined, allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // The user object from JwtAuthGuard

    if (!user) {
      throw new ForbiddenException('Access Denied: No user information');
    }

    const hasRole = roles.some(role => user.role === role); // Check if user has any of the permitted roles
    if (!hasRole) {
      throw new ForbiddenException('Access Denied: Insufficient role');
    }

    return true;
  }

}