import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan,  EntityManager } from "typeorm";
import { Package } from "./entities/package.entity";
import {
  UserSubscription,
  SubscriptionStatus,
} from "./entities/user-subscription.entity";
import { Usage, UsageType } from "./entities/usage.entity";
import { User } from "src/users/entities/user.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CreatePackageDto } from "./dto/create-package.dto";
import { FreeSubscriptionPackageDto, SubscribePackageDto } from "./dto/subscribe-package.dto";
import { UpdatePackageDto } from "./dto/update-package.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BookGeneration } from "src/book-generation/entities/book-generation.entity";
import { BookChapter } from "src/book-chapter/entities/book-chapter.entity";
import { CardPaymentService } from "src/card-payment/card-payment.service";
import { Transaction, TransactionType } from "src/transaction/entities/transaction.entity";
import { TransactionService } from "src/transaction/transaction.service";
import { EmailService } from "src/auth/services/email.service";
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Package)
    private packageRepository: Repository<Package>,

    @InjectRepository(UserSubscription)
    private userSubscriptionRepository: Repository<UserSubscription>,

    @InjectRepository(Usage)
    private usageRepository: Repository<Usage>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    private eventEmitter: EventEmitter2,
    private cardPaymentService: CardPaymentService,
    private emailService: EmailService,
    private settingsService: SettingsService,
  ) {}

  // ADMIN: Create package
  async createPackage(
    userId: number,
    packageData: CreatePackageDto
  ): Promise<Package> {
    const packages = new Package();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User  not found");
    }
    packages.user = user;
    if (packageData.features) packages.features = packageData.features;
    if (packageData.durationDays) packages.durationDays = packageData.durationDays;
    if (packageData.isActive) packages.isActive = packageData.isActive;
    if (packageData.imageLimit) packages.imageLimit = packageData.imageLimit;
    if (packageData.imageModelType) packages.imageModelType = packageData.imageModelType;
    if (packageData.modelType) packages.modelType = packageData.modelType;
    if (packageData.name) packages.name = packageData.name;
    if (packageData.price) packages.price = packageData.price;
    if (packageData.tokenLimit) packages.tokenLimit = packageData.tokenLimit;
if(packageData.imageModelURL)packages.imageModelURL=packageData.imageModelURL
if(packageData.description)packages.description=packageData.description
    const newPackage = this.packageRepository.create(packages);
    return this.packageRepository.save(newPackage);
  }
  async updateSubscription(
    userId: number,
    packageId: number|null,
    totalTokens: number,
    images?:number
  ): Promise<UserSubscription> {
    // Step 1: Check if the user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User  not found");
    }
  
    // Step 2: Check if the subscription exists for the given user and package
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: userId },
        package: { id: packageId },
        status: SubscriptionStatus.ACTIVE, // Ensure the subscription is active
      },
    });
  
    if (!subscription) {
      throw new NotFoundException("Active subscription not found for the user and package");
    }
  if(images){
    subscription.imagesGenerated+=images
  }
    // Step 3: Update the tokensUsed field
    subscription.tokensUsed += totalTokens; // Increment the tokens used

    await this.userSubscriptionRepository.save(subscription); // Save the updated subscription
  
    return subscription; // Return the updated subscription
  }

  // ADMIN: Get all packages
  async getAllPackages(includeInactive = false): Promise<Package[]> {
    if (includeInactive) {
      return this.packageRepository.find();
    }
    return this.packageRepository.find({ where: { isActive: true } });
  }

  // USER: Subscribe to a package
  async subscribeToPackage(
    userId: number,
    subscribeDto: SubscribePackageDto
  ): Promise<UserSubscription> {
    try {
      // Get settings for token multiplication
      const settings = await this.settingsService.getAllSettings();
      if (!settings) {
        throw new Error('Settings not found');
      }
      
      return await this.userRepository.manager.transaction(
        async (entityManager: EntityManager) => {
          const user = await entityManager.findOne(User, {
            where: { id: userId },
          });
          if (!user) {
            throw new NotFoundException("User not found");
          }

          const packageEntity = await entityManager.findOne(Package, {
            where: { id: subscribeDto.packageId, isActive: true },
          });
          if (!packageEntity) {
            throw new NotFoundException("Package not found or inactive");
          } else if(Number(packageEntity.price) > Number(user.availableAmount)) {
            throw new BadRequestException("Recharge your account");
          }

          // Check for existing active subscription
          const existingSubscription = await entityManager.findOne(
            UserSubscription,
            {
              where: {
                user: { id: userId },
                status: SubscriptionStatus.ACTIVE,
                package: { id: subscribeDto.packageId }
              },
            }
          );

          if (existingSubscription) {
            if (subscribeDto.cancelExisting) {
              existingSubscription.status = SubscriptionStatus.CANCELLED;
              await entityManager.save(UserSubscription, existingSubscription);
            } else {
              throw new BadRequestException("User already has an active subscription");
            }
          }

          const alreadyExistingSubscription = await entityManager.findOne(
            UserSubscription,
            {
              where: {
                user: { id: userId },
                status: SubscriptionStatus.ACTIVE,
              },
            }
          );

          if(alreadyExistingSubscription) {
            throw new BadRequestException("User already has an active subscription");
          }

          // Create new subscription with multiplied tokens
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + packageEntity.durationDays);

          // Update user's available amount
          user.availableAmount = user.availableAmount - packageEntity.price;
          await entityManager.update(User, user.id, {
            availableAmount: user.availableAmount,
          });

          // Multiply tokens and images with settings values
          const totalTokens = packageEntity.tokenLimit * settings.creditsPerModelToken;
          const totalImages = packageEntity.imageLimit * settings.creditsPerImageToken;

          const subscription = entityManager.create(UserSubscription, {
            user,
            package: packageEntity,
            totalTokens,
            totalImages,
            startDate,
            endDate,
            status: SubscriptionStatus.ACTIVE,
            autoRenew: subscribeDto.autoRenew || false,
          });

          return await entityManager.save(UserSubscription, subscription);
        }
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
  async unSubscribeToPackage(
    id:number,
    userId: number,
  ): Promise<UserSubscription> {
    try {
      return await this.userRepository.manager.transaction(
        async (entityManager: EntityManager) => {
          // Find the user
          const user = await entityManager.findOne(User, {
            where: { id: userId },
          });
          if (!user) {
            throw new NotFoundException("User  not found");
          }
  
        
          // Find the user's subscription to the package
          const userSubscription = await entityManager.findOne(UserSubscription, {
            where: { user: { id: user.id }, package: { id },status:SubscriptionStatus.ACTIVE },
          });
          if (!userSubscription) {
            throw new NotFoundException("User  subscription not found");
          }
  
          // Update the subscription status to CANCELLED
          userSubscription.status = SubscriptionStatus.CANCELLED;
          await entityManager.save(UserSubscription, userSubscription);
  
          // Optionally, deactivate the package if needed
       
          return userSubscription;
        }
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // Track token usage
  async trackTokenUsage(
    userId: number,
    resource: string,
    type:UsageType,
    metadata?: Record<string, any>,
    book?: BookGeneration,
    bookChapters?:number
  ): Promise<void> {
   try {
    
   
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Find active subscription
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: userId },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new BadRequestException("User has no active subscription");
    }

    // Log usage
    const usage = this.usageRepository.create({
      user,
      subscription,
      type: type?? UsageType.TOKEN,
      resource,
      metadata
    });
    if(book){
      usage.bookGeneration=book
    }
if(bookChapters){
  usage.chapterNo=bookChapters
}
    await this.usageRepository.save(usage);
  } catch (error) {
    throw new Error(error.message)
  }
  }
  async updateTrackTokenUsage(
    user: User,
    packages:Package,
    book?: BookGeneration,
    chapterNo?:number

  ): Promise<void> {
   try {

    // Find active subscription
    const subscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: user.id },
        package:{id:packages?.id},
        status: SubscriptionStatus.ACTIVE,
      },
    });
    if (!subscription) {
      throw new BadRequestException("User has no active subscription");
    }
    const usage = await this.usageRepository.findOne({
      where: {
        user: { id: user.id },
        subscription:{id:subscription.id},  
      },
      order: {
        createdAt: 'DESC', // Replace 'createdAt' with the actual field you want to order by
      },
    });
    if (!usage) {
      throw new BadRequestException("Usage not found");
    }

    usage.bookGeneration=book
    if(chapterNo)usage.chapterNo=chapterNo
    await this.usageRepository.update(usage.id, usage);
  } catch (error) {
   throw new Error(error.message) 
  }
  }



  // Get user's active subscription
  async getUserActiveSubscription(userId: number): Promise<UserSubscription[]> {
    const subscription = await this.userSubscriptionRepository.find({
      where: {
        user: { id: userId },
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ["package"],
    });

    if (!subscription) {
      throw new NotFoundException("No active subscription found");
    }

    return subscription;
  }

  // Get user's subscription usage
  async getUserUsage(userId: number): Promise<any> {
    const subscriptions = await this.getUserActiveSubscription(userId);

    return subscriptions.map(subscription => ({
      package: subscription.package,
      tokensUsed: subscription.tokensUsed,
      tokenLimit: subscription.totalTokens,
      imagesGenerated: subscription.imagesGenerated,
      imageLimit: subscription.totalImages,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      daysRemaining: Math.ceil(
          (subscription.endDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      ),
  }));
  }


  async tryAutoRecharge(user: User, amount: number): Promise<boolean> {
    try {
      // You'd probably use Stripe or another payment API here
      const payment = await this.cardPaymentService.chargeWallet({
        userId: user.id,
        amount,
        currency: 'USD',
      });
  
    
      return true;
    } catch (error) {
      this.logger.error(`Auto recharge error for user ${user.id}: ${error.message}`);
      return false;
    }
  }
  

  // CRON: Check for expired subscriptions daily
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    this.logger.log("Checking for expired subscriptions");

    const now = new Date();
    const expiredSubscriptions = await this.userSubscriptionRepository.find({
      where: {
        endDate: LessThan(now),
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ["user", "package"],
    });

    for (const subscription of expiredSubscriptions) {
      let updatedUser: User
      if (subscription.autoRenew) {
        // Handle auto-renewal logic here, potentially integrating with a payment service
        this.logger.log(
          `Auto-renewing subscription ${subscription.id} for user ${subscription.user.id}`
        );
    const user = await this.userRepository.findOne({ where: { id:subscription.user.id } });
    if (!user) {
      throw new NotFoundException("User  not found");
    }

    if(Number(user.availableAmount)<Number(subscription.package.price)){
      
      const paymentSucceeded = await this.tryAutoRecharge(user, Number(subscription.package.price));

  if (!paymentSucceeded) {
    this.logger.warn(`Auto recharge failed for user ${user.id}. Sending notification.`);
    await this.emailService.sendInsufficientFundsEmail(user.email);
return {message:"email send successfully"}
  }
   updatedUser = await this.userRepository.findOne({ where: { id: user.id } });
  if (Number(updatedUser.availableAmount) < Number(subscription.package.price)) {
    this.logger.error(`Recharge succeeded but balance still insufficient for user ${user.id}`);
    continue;
  }
}
    
   const deduction= Number(updatedUser.availableAmount)-Number(subscription.package.price)
  await this.userRepository.update(user.id,{availableAmount:deduction})
    // Create new subscription period
        const newEndDate = new Date(subscription.endDate);
        newEndDate.setDate(
          newEndDate.getDate() + subscription.package.durationDays
        );

        subscription.startDate = subscription.endDate;
        subscription.endDate = newEndDate;
        subscription.tokensUsed = 0;
        subscription.imagesGenerated = 0;

        await this.userSubscriptionRepository.save(subscription);
      } else {
        // Mark as expired
        this.logger.log(
          `Marking subscription ${subscription.id} as expired for user ${subscription.user.id}`
        );
        subscription.status = SubscriptionStatus.EXPIRED;
        await this.userSubscriptionRepository.save(subscription);
      }
    }
  }
  async updatePackage(
    packageId: number, 
    userId: number, 
    updatePackageDto: UpdatePackageDto
  ): Promise<Package> {
    const packageEntity = await this.packageRepository.findOne({ 
      where: { id: packageId } 
    });
    
    if (!packageEntity) {
      throw new NotFoundException('Package not found');
    }
    
    // Update only the provided fields
    Object.assign(packageEntity, updatePackageDto);
    
    // Save the updated package
    const updatedPackage = await this.packageRepository.save(packageEntity);
    
    // Create a transaction record if isActive status changed
    if (updatePackageDto.isActive !== undefined && 
        updatePackageDto.isActive !== packageEntity.isActive) {
      this.eventEmitter.emit('package.status.updated', {
        packageId: packageId,
        userId: userId,
        newStatus: updatePackageDto.isActive ? 'active' : 'inactive',
        packageName: packageEntity.name
      });
    }
    
    return updatedPackage;
  }
  
  async createFreeSubscription(input: FreeSubscriptionPackageDto): Promise<UserSubscription> {
    try {
      // Get settings for token multiplication
      const settings = await this.settingsService.getAllSettings();
      if (!settings) {
        throw new Error('Settings not found');
      }

      const user = await this.userRepository.findOne({
        where: { id: input.userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check for existing active subscription
      const existingSubscription = await this.userSubscriptionRepository.findOne({
        where: {
          user: { id: input.userId },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (existingSubscription) {
        throw new BadRequestException('User already has an active subscription');
      }

      // Multiply tokens and images with settings values
      const totalTokens = input.tokenLimit * settings.creditsPerModelToken;
      const totalImages = input.imageLimit * settings.creditsPerImageToken;

      const subscription = this.userSubscriptionRepository.create({
        user,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        totalTokens,
        totalImages,
        autoRenew: input.autoRenew || false,
      });

      return await this.userSubscriptionRepository.save(subscription);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  
}
