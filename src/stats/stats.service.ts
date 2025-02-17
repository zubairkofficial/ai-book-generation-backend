import { Injectable } from "@nestjs/common";
import { CreateStatDto } from "./dto/create-stat.dto";
import { UpdateStatDto } from "./dto/update-stat.dto";
import { UsersService } from "../users/users.service"; // Assume you have a UsersService
import { BookGenerationService } from "src/book-generation/book-generation.service";

@Injectable()
export class StatsService {
  constructor(
    private readonly usersService: UsersService, // Injecting UsersService
    private readonly booksService: BookGenerationService // Injecting BooksService
  ) {}

  async create(createStatDto: CreateStatDto) {
    try {
      // Your logic to create a stat
      return "This action adds a new stat";
    } catch (error) {
      // Handle errors here
      throw new Error("Error creating stat: " + error.message);
    }
  }

  async getAllStats(user: { id: number; email?: string; role: string }) {
    const isAdmin = user.role == "admin";
    const userId = !isAdmin ? user.id:null;
    try {
      // Fetch all users and books
      const users = await this.usersService.getAllUsersCount();
      const books = await this.booksService.getAllBooksCount(userId);
      if (!isAdmin) return { books };
      else return { users, books };
    } catch (error) {
      // Handle errors here
      throw new Error("Error fetching stats: " + error.message);
    }
  }

  async findOne(id: number) {
    try {
      // Logic for fetching one stat, e.g., by ID
      return `This action returns a #${id} stat`;
    } catch (error) {
      // Handle errors here
      throw new Error("Error fetching stat: " + error.message);
    }
  }

  async update(id: number, updateStatDto: UpdateStatDto) {
    try {
      // Your logic for updating a stat
      return `This action updates a #${id} stat`;
    } catch (error) {
      // Handle errors here
      throw new Error("Error updating stat: " + error.message);
    }
  }

  async remove(id: number) {
    try {
      // Your logic for removing a stat
      return `This action removes a #${id} stat`;
    } catch (error) {
      // Handle errors here
      throw new Error("Error removing stat: " + error.message);
    }
  }
}
