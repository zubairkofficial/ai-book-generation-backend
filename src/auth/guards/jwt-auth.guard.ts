import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken'; // Import jsonwebtoken library
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    console.log('Incoming Request:', {
      method: request.method,
      url: request.url,
      headers: request.headers, // Be cautious with logging headers in production
    });

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Unauthorized Request: Missing or Invalid Authorization Header');
      throw new UnauthorizedException('Authorization header is missing or invalid.');
    }

    // Extract JWT token from Bearer header
    const token = authHeader.split(' ')[1];

    try {
      // Decode JWT token
      const decodedUser = jwt.verify(token, process.env.JWT_SECRET) as any;

      console.log('Decoded JWT Payload:', decodedUser); // Log user info for debugging

      // Attach user data globally in the request object
      request.user = decodedUser;
    } catch (error) {
      console.error('JWT Decoding Failed:', error.message);
      throw new UnauthorizedException('Unauthorized: Token is invalid or expired.');
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      console.error('JWT Authentication Failed:', {
        error: err || 'No user found',
        reason: info ? info.message : 'Token might be expired or invalid',
      });

      throw new UnauthorizedException('Unauthorized: Token is invalid or expired.');
    }

    return user; // Ensure user is returned for further role checks
  }
}
