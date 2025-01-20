import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('Request Headers:', request.headers); // Log all headers
    const authHeader = request.headers.authorization;
    console.log('Authorization Header:', authHeader);

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

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