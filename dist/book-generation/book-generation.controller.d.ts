import { BookGenerationService } from './book-generation.service';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface';
export declare class BookGenerationController {
    private readonly bookGenerationService;
    private readonly logger;
    constructor(bookGenerationService: BookGenerationService);
    generateBook(bookGenerationDto: BookGenerationDto, request: RequestWithUser): Promise<{
        message: string;
        data: import("./entities/book-generation.entity").BookGeneration;
    }>;
    getAllBooks(request: RequestWithUser): Promise<{
        message: string;
        data: import("./entities/book-generation.entity").BookGeneration[];
    }>;
}
