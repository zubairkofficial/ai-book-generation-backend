import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CryptoService } from 'src/utils/crypto.service';
import { ApiKeysService } from 'src/api-keys/api-keys.service';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User,ApiKey])], // Register the User entity
  controllers: [UsersController],
  providers: [UsersService,CryptoService,ApiKeysService],
  exports: [UsersService], // Export UsersService for use in other modules
})
export class UsersModule {}