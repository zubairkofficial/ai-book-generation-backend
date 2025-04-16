import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
// Import any email service you're using, like nodemailer, SendGrid, etc.

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    // Inject email service
  ) {}
  
  async sendEmail(params: {
    to: number | string; // User ID or email
    template: string;
    data: any;
  }): Promise<void> {
    try {
      let email: string;
      
      // If we got a user ID, fetch the user's email
      if (typeof params.to === 'number') {
        const user = await this.userRepository.findOne({ where: { id: params.to } });
        if (!user) {
          throw new Error(`User with ID ${params.to} not found`);
        }
        email = user.email;
      } else {
        email = params.to;
      }
      
      // Log the notification (in a real app, you'd send an actual email)
      this.logger.log(`Sending email: ${params.template} to ${email}`);
      this.logger.debug(`Email data: ${JSON.stringify(params.data)}`);
      
      // Here you would integrate with your email provider
      // Example:
      // await this.emailService.send({
      //   to: email,
      //   templateId: this.getTemplateId(params.template),
      //   dynamicData: params.data
      // });
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
    }
  }
  
  // Helper to map template names to IDs in your email service
  private getTemplateId(templateName: string): string {
    const templates = {
      'subscription-expired': 'template-id-1',
      'subscription-expiring-soon': 'template-id-2',
      'subscription-renewed': 'template-id-3',
      'payment-failed': 'template-id-4',
    };
    
    return templates[templateName] || 'default-template-id';
  }
} 