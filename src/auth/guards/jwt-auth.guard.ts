import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken'; // Import jsonwebtoken library
import { Request } from 'express';
import { Logger } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    
    this.logger.log(`Authentication check for: ${request.method} ${request.url}`);

    let token: string;

    // Check if token is provided in the Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      this.logger.log('Token found in Authorization header');
    } 
    // Check if token is provided in query parameters (for SSE endpoints)
    else if (request.query.token) {
      token = request.query.token as string;
      this.logger.log('Token found in query parameter');
    }

    if (!token) {
      this.logger.warn('No token found in request');
      throw new UnauthorizedException('Authorization token is missing or invalid.');
    }

    try {
      // Decode JWT token
      const decodedUser = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Attach user data to the request object
      request.user = decodedUser;
      
      // Skip passport processing for SSE requests with token in query parameter
      if (request.query.token) {
        // For SSE requests with query token, return true to bypass passport
        return true;
      }
      
      // For regular requests, use passport
      return super.canActivate(context);
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException('Unauthorized: Token is invalid or expired.');
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // For SSE endpoints with token in query, we already validated the token
    const request = context.switchToHttp().getRequest();
    if (request.query.token && request.user) {
      return request.user;
    }
    
    if (err || !user) {
      throw new UnauthorizedException('Unauthorized: Token is invalid or expired.');
    }

    return user;
  }
}
