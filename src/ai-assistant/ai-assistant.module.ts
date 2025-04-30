import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiAssistant } from "./entities/ai-assistant.entity";
import { AiAssistantService } from "./ai-assistant.service";
import { AiAssistantController } from "./ai-assistant.controller";
import { ApiKeysModule } from "src/api-keys/api-keys.module"; 
import { UsersModule } from "src/users/users.module";
import { SettingsModule } from "src/settings/settings.module";
import { BookChapterService } from "src/book-chapter/book-chapter.service";
import { SubscriptionService } from "src/subscription/subscription.service";
import { BookChapter } from "src/book-chapter/entities/book-chapter.entity";
import { BookGeneration } from "src/book-generation/entities/book-generation.entity";
import { Package } from "src/subscription/entities/package.entity";
import { UserSubscription } from "src/subscription/entities/user-subscription.entity";
import { Usage } from "src/subscription/entities/usage.entity";
import { User } from "src/users/entities/user.entity";
import { CardPaymentService } from "src/card-payment/card-payment.service";
import { EmailService } from "src/auth/services/email.service";
import { CardPayment } from "src/card-payment/entities/card-payment.entity";
import { TransactionService } from "src/transaction/transaction.service";
import { Transaction } from "src/transaction/entities/transaction.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAssistant,BookChapter,BookGeneration,Package,UserSubscription,Usage,User,CardPayment,Transaction]), 
    ApiKeysModule,  
    UsersModule, // Ensure correct indentation
    SettingsModule,
    ApiKeysModule
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService,BookChapterService,SubscriptionService,CardPaymentService,EmailService,TransactionService], // Remove UsersService, as it is provided by UsersModule
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
