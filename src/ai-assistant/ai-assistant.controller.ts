import { Body, Controller, Get, InternalServerErrorException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AiAssistant } from "./entities/ai-assistant.entity";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantDto, AiAssistantMessage } from "./dto/ai-assistant.dto";
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
   try {
    
   
    const userId = request.user?.id;
    return this.aiAssistantService.processAiAssistantTask(userId,input)
  } catch (error) {
    throw new InternalServerErrorException(error.message)
  }
  }
  @UseGuards(JwtAuthGuard)
  @Post('chat')
  async getAiAssistantChat( @Body() input:AiAssistantMessage, @Req() request: RequestWithUser,) {
   try {
   
    const userId = request.user?.id;
    return this.aiAssistantService.getAiAssistantChat(userId,input)
  } catch (error) {
    throw new InternalServerErrorException(error.message)
  }
  }
}
