export declare class BookGenerationDto {
    bookTitle: string;
    genre: string;
    theme: string;
    characters: string;
    setting: string;
    tone: string;
    plotTwists: string;
    numberOfPages: number;
    numberOfChapters: number;
    targetAudience: string;
    language: string;
    additionalContent: string;
    advancedOptions?: {
        coverImagePrompt?: string;
        colorScheme?: string;
        fontStyle?: string;
    };
}
