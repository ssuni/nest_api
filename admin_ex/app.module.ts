import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common.module';
import { AwsModule } from './aws/aws.module';
import { StatisticalModule } from './statistical/statistical.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ApiplexModule } from './apiplex/apiplex.module';
import { PartnerModule } from './partner/partner.module';
import { ApprovalManagementModule } from './approval_management/approval_management.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CampaignModule } from './campaign/campaign.module';
import { UsageStatusModule } from './usage_status/usage_status.module';
import { AddressModule } from './address/address.module';
import { InventoryManagementModule } from './inventory_management/inventory_management.module';
import { DataSource } from 'typeorm';
import { PostModule } from './post/post.module';
import { ReviewModule } from './review/review.module';
import { FcmModule } from './fcm/fcm.module';
import { AdminDashboardModule } from './admin_dashboard/admin_dashboard.module';
import { CronjobModule } from './cronjob/cronjob.module';
import { ExcelModule } from './excel/excel.module';
import { NotificationTalkModule } from './notification_talk/notification_talk.module';
import { PartnerMiddleware } from './middleware/partner.middleware';
import { JwtService } from '@nestjs/jwt';
import { TermsModule } from './terms/terms.module';
import { GuideModule } from './guide/guide.module';
import { AdvertisementModule } from './advertisement/advertisement.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MembershipManagementModule } from './membership_management/membership_management.module';
import { EmailModule } from './email/email.module';
import { NoticeModule } from './notice/notice.module';
import { WithdrawalModule } from './withdrawal/withdrawal.module';
import { ProfileModule } from './profile/profile.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { WaugModule } from './waug/waug.module';
import { PortfolioScoreModule } from './portfolio_score/portfolio_score.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { BannerModule } from './banner/banner.module';
import { PopupModule } from './popup/popup.module';
import { NoticeManagementModule } from './notice_management/notice_management.module';
import { AdminManagementModule } from './admin_management/admin_management.module';
import { BusinessInfoModule } from './business_info/business_info.module';
import { TypeOrmCustomLogger } from './util/typeorm-logger';
import { AgodaModule } from './agoda/agoda.module';
import { TripModule } from './trip/trip.module';
import { WairiFcmModule } from './wairi_fcm/wairi_fcm.module';
import { VanillaplantModule } from './vanillaplant/vanillaplant.module';
// import * as process from 'process';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.register(),
    CommonModule,
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_SCHEMA,
      autoLoadEntities: true,
      entities: [__dirname + '/../entity/entities/*.ts'],
      synchronize: false,
      // logging: true,
      // logging: ['schema', 'error'],
      logging: true, // true로 설정해야 커스텀 로거가 작동함
      logger: new TypeOrmCustomLogger(), // 👈 이 부분이 핵심
      charset: 'utf8mb4_unicode_ci',
      // timezone: '+09:00',
      extra: {
        connectionLimit: 10, // 연결 풀의 최대 연결 수
        waitForConnections: true, // 연결 풀에서 유효한 연결이 없으면 대기
        queueLimit: 0, // 대기열 제한을 설정하지 않음 (제한 없음)
        enableKeepAlive: true, // 연결 유지 활성화
        keepAliveInitialDelay: 10000, // 10초마다 연결 유지 유효성 검사
      },
    }),
    // 추가 DB 연결 (이름 지정 필수)
    TypeOrmModule.forRoot({
      name: 'secondaryConnection',
      type: 'mysql',
      host: process.env.SECOND_DB_HOST,
      port: Number(process.env.SECOND_DB_PORT),
      username: process.env.SECOND_DB_USER,
      password: process.env.SECOND_DB_PASSWORD,
      database: process.env.SECOND_DB_SCHEMA,
      // entities: [__dirname + '/../entity/secondary_entities/*.ts'],
      entities: [__dirname + '/../entity/secondary_entities/**/*{.js,.ts}'],
      synchronize: false,
      logging: true, // true로 설정해야 커스텀 로거가 작동함
      logger: new TypeOrmCustomLogger(), // 👈 이 부분이 핵심
      charset: 'utf8mb4_unicode_ci',
      // timezone: '+09:00',
      extra: {
        typeCast: function (field, next) {
          if (field.type === 'VAR_STRING' && field.name === 'version') {
            const val = field.string();
            return typeof val === 'string' ? val : val?.toString('utf8');
          }
          return next();
        },
        connectionLimit: 10, // 연결 풀의 최대 연결 수
        waitForConnections: true, // 연결 풀에서 유효한 연결이 없으면 대기
        queueLimit: 0, // 대기열 제한을 설정하지 않음 (제한 없음)
        enableKeepAlive: true, // 연결 유지 활성화
        keepAliveInitialDelay: 10000, // 10초마다 연결 유지 유효성 검사
      },
    }),
    DashboardModule,
    AuthModule,
    AwsModule,
    StatisticalModule,
    SchedulesModule,
    ApiplexModule,
    PartnerModule,
    ApprovalManagementModule,
    CampaignModule,
    UsageStatusModule,
    AddressModule,
    InventoryManagementModule,
    PostModule,
    ReviewModule,
    FcmModule,
    AdminDashboardModule,
    CronjobModule,
    ExcelModule,
    NotificationTalkModule,
    TermsModule,
    GuideModule,
    AdvertisementModule,
    MembershipManagementModule,
    EmailModule,
    NoticeModule,
    WithdrawalModule,
    ProfileModule,
    PortfolioModule,
    WaugModule,
    PortfolioScoreModule,
    AffiliateModule,
    BannerModule,
    PopupModule,
    NoticeManagementModule,
    AdminManagementModule,
    BusinessInfoModule,
    AgodaModule,
    TripModule,
    WairiFcmModule,
    VanillaplantModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtService],
})
export class AppModule implements NestModule {
  constructor(private dataSource: DataSource) {}
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PartnerMiddleware).forRoutes('*');
  }
}
