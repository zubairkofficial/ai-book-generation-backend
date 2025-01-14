import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as dotenv from 'dotenv';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  dotenv.config();
  app.setGlobalPrefix('api/v1'); // All routes will be prefixed with /api/v1

  // Enable validation pipes globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      // Custom error response for validation errors
      const formattedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }));
      return new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // Enable CORS
  app.enableCors();
  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Authentication API')
    .setDescription('API documentation for the authentication system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(`running server on port ${port}`)
}
bootstrap();