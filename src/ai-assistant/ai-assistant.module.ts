import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiAssistant } from "./entities/ai-assistant.entity";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantController } from "./ai-assistant.controller";
import { ApiKeysModule } from "src/api-keys/api-keys.module"; 
import { UsersModule } from "src/users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAssistant]), 
    ApiKeysModule,  
    UsersModule, // Ensure correct indentation
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService], // Remove UsersService, as it is provided by UsersModule
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
