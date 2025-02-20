import { Injectable } from "@nestjs/common";
import { CreateStatDto } from "./dto/create-stat.dto";
import { UpdateStatDto } from "./dto/update-stat.dto";
import { UsersService } from "../users/users.service"; // Assume you have a UsersService
import { BookGenerationService } from "src/book-generation/book-generation.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookGeneration } from "src/book-generation/entities/book-generation.entity";

@Injectable()
export class StatsService {
  constructor(
    private readonly usersService: UsersService, // Injecting UsersService
    private readonly booksService: BookGenerationService, // Injecting BooksService
    @InjectRepository(BookGeneration)
    private readonly bookGenerationRepository: Repository<BookGeneration>
  ) {}



  async getAllStats(user: { id: number; email?: string; role: string }) {
    const isAdmin = user.role == "admin";
    const userId = !isAdmin ? user.id:null;
    try {
      // Fetch all users and books
      const users = await this.usersService.getAllUsersCount();
      const books = await this.booksService.getAllBooksCount(userId);
      const booksPerMonth = await this.getBooksCountByMonth(userId);
      const allMonths = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
  
      // Map database result to chart format & ensure missing months are filled with 0
      const chartData = allMonths.map((month, index) => ({
        name: month,
        books: booksPerMonth[index] ?? 0, // Use existing value or 0 if missing
      }));
  
      
      if (!isAdmin) return { books,chartData };
      else return { users, books,chartData };
    } catch (error) {
      // Handle errors here
      throw new Error("Error fetching stats: " + error.message);
    }
  }

  async getBooksCountByMonth(userId?: number): Promise<number[]> {
    const query = this.bookGenerationRepository
  .createQueryBuilder("book_generation")
  .select(["EXTRACT(MONTH FROM book_generation.createdAt) AS month", "COUNT(book_generation.id) AS count"])
  .where(userId ? "book_generation.userId = :userId" : "1=1", userId ? { userId } : {})
  .groupBy("month")
  .orderBy("month", "ASC");

    const result = await query.getRawMany();
  
    // Initialize array for all 12 months with 0 values
    const booksPerMonth = new Array(12).fill(0);
    
    result.forEach((row) => {
      booksPerMonth[row.month - 1] = parseInt(row.count, 10);
    });
  
    return booksPerMonth;
  }
  


}
