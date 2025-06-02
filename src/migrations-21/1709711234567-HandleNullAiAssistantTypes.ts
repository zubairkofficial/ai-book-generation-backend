import { MigrationInterface, QueryRunner } from "typeorm";

export class HandleNullAiAssistantTypes1709711234567 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, update any null types to a default value
        await queryRunner.query(`
            UPDATE ai_assistant 
            SET type = 'book_idea' 
            WHERE type IS NULL
        `);

        // Then make the column non-nullable
        await queryRunner.query(`
            ALTER TABLE ai_assistant 
            ALTER COLUMN type SET NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Make the column nullable again
        await queryRunner.query(`
            ALTER TABLE ai_assistant 
            ALTER COLUMN type DROP NOT NULL
        `);
    }
} 