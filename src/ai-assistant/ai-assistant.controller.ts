import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AiAssistant } from "./entities/ai-assistant.entity";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantDto } from "./dto/ai-assistant.dto";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RequestWithUser } from "src/auth/types/request-with-user.interface";

@Controller("ai-assistant")
export class AiAssistantController {
  constructor(
    private readonly aiAssistantService: AiAssistantService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async getAiAssistantResponse( @Body() input:AiAssistantDto, @Req() request: RequestWithUser,): Promise<AiAssistant> {
    const userId = request.user?.id;
    return this.aiAssistantService.processAiAssistantTask(userId,input)
  }
}
