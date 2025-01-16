import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BookGenerationDto } from './dto/create-book-generation.dto';
import { BookGeneration } from './entities/book-generation.entity';
export declare class BookGenerationService {
    private configService;
    private bookGenerationRepository;
    private model;
    private readonly logger;
    constructor(configService: ConfigService, bookGenerationRepository: Repository<BookGeneration>);
    generateAndSaveBook(userId: number, promptData: BookGenerationDto): Promise<BookGeneration>;
    private createBookContent;
}
