import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  
  canActivate(context: ExecutionContext) {

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization; // Log the entire Authorization header
    console.log('Authorization Header:', authHeader);
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      console.error('JWT Error:', err || 'No user found');
      throw new UnauthorizedException('Unauthorized: Token is invalid or expired.');
    }
    return user;
  }
}