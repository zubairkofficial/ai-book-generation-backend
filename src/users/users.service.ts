import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/users.dto';
import { compare } from 'bcryptjs';
import { CryptoService } from 'src/utils/crypto.service';
import { BookType } from 'src/book-generation/entities/book-generation.entity';
import { CreateCardTokenDto } from 'src/card-payment/dto/payment.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
       private readonly cryptoService: CryptoService, // Inject CryptoService
      
  ) {}


  async getProfileByStats(id: number): Promise<{
    user: User;
    stats: {
      totalBooks: number;
      completed: number;
      inProgress: number;
    };
  }> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['bookGenerations'] // Load book generations relation
    });
  
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    // Calculate statistics
    const totalBooks = user.bookGenerations.length;
    const completed = user.bookGenerations.filter(
      bg => bg.type === BookType.COMPLETE
    ).length;
    const inProgress = totalBooks - completed;
  
    return {
      user,
      stats: {
        totalBooks,
        completed,
        inProgress
      }
    };
  }
  
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
  async getUserWithBookInfo(): Promise<any> {
   try {
    
    const usersWithBookCount = await this.userRepository
    .createQueryBuilder('user')
    .leftJoin('user.bookGenerations', 'bookGeneration') // Join bookGenerations
    .addSelect('COUNT(bookGeneration.id)', 'bookCount') // Count bookGenerations
    .groupBy('user.id') // Group by user id to get the count per user
    .getRawMany(); // Fetch raw data without full entities

  return usersWithBookCount;
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
       
  }
  }
  async updateUserPayment(cardData: CreateCardTokenDto,user: User): Promise<any> {
   try {
    user.availableAmount=Number(user.availableAmount)+Number(cardData.amount)
    return this.userRepository.save(user)
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
       
  }
  }
  
}