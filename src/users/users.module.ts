import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CryptoService } from 'src/utils/crypto.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Register the User entity
  controllers: [UsersController],
  providers: [UsersService,CryptoService],
  exports: [UsersService], // Export UsersService for use in other modules
})
export class UsersModule {}