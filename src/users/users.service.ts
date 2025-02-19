import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/users.dto';
import { compare } from 'bcryptjs';
import { CryptoService } from 'src/utils/crypto.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
       private readonly cryptoService: CryptoService, // Inject CryptoService
      
  ) {}

  async getProfile(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
   
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
  // users.service.ts
async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<User> {
  const user = await this.getProfile(id);

  // Check if oldPassword is provided and matches the current password
  if (updateUserDto.oldPassword && updateUserDto.newPassword) {
    const isPasswordValid = await compare(updateUserDto.oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }
    user.password= await this.cryptoService.encrypt(updateUserDto.newPassword);
  }

  // Update other fields
  Object.assign(user, updateUserDto);
  return this.userRepository.save(user);
}

  async findByEmail(email: string): Promise<User> {
    console.log('Email to find:', email); 
    const user = await this.userRepository.findOne({ where: { email } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async updatePassword(id: number, newPassword: string): Promise<void> {
    await this.userRepository.update(id, { password: newPassword });
  }


  async update(id: number, updateData: Partial<User>): Promise<void> {
    await this.userRepository.update(id, updateData);
  }
  async getAllUsersCount(): Promise<number> {
   return await this.userRepository.count();
  }
  
  async markEmailAsVerified(id: number): Promise<void> {
    await this.userRepository.update(id, { isEmailVerified: true });
  }
}