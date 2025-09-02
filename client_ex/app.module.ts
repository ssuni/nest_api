import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
// import {Module} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import * as process from 'process';
//entities
import { Member } from '../entity/entities/Member';
import { Campaign } from '../entity/entities/Campaign';
import { CampaignItem } from '../entity/entities/CampaignItem';
import { CampaignImage } from '../entity/entities/CampaignImage';
import { Cate } from '../entity/entities/Cate';
import { CateArea } from '../entity/entities/CateArea';
import { Partner } from '../entity/entities/Partner';
import { CampaignReview } from '../entity/entities/CampaignReview';
import { Board } from '../entity/entities/Board';
import { BoardArticles } from '../entity/entities/BoardArticles';
import { CampaignRecent } from '../entity/entities/CampaignRecent';
import { CampaignItemSchedule } from '../entity/entities/CampaignItemSchedule';
import { MemberChannel } from '../entity/entities/MemberChannel';
import { CampaignFav } from '../entity/entities/CampaignFav';
import { NotificationTalkCallBack } from '../entity/entities/NotificationTalkCallBack';
import { CampaignSubmitBackup } from '../entity/entities/CampaignSubmitBackup';
import { MemberDevice } from '../entity/entities/MemberDevice';
import { PortfolioNaver } from '../entity/entities/PortfolioNaver';
//modules
import { AuthModule } from './auth/auth.module';
import { CampaignModule } from './campaign/campaign.module';
// import { UploadModule } from './upload/upload.module';
import { ReviewModule } from './review/review.module';
import { NoticeModule } from './notice/notice.module';
import * as moment from 'moment';

//GraphQL
import { MemberModule } from './graphql/member_model/member.module';
import { Campaign_gqlModule } from './graphql/campaign_model/campaign_gql.module';

import { BigIntResolver, DateResolver, DateTimeResolver } from 'graphql-scalars';
// import { AuthQlModule } from './auth_ql/auth_ql.module';
import { Auth_gqlModule } from './graphql/auth_model/auth_gql.module';
import { AuthQlModelModule } from './graphql/auth_ql_model/auth_ql_model.module';

import { LoggerMiddleware } from './middlewares/logger.middleware';
import { Config } from '../entity/entities/Config';
import { BannerModelModule } from './graphql/banner_model/banner_model.module';
import { Banner } from '../entity/entities/Banner';
import { CateModelModule } from './graphql/cate_model/cate_model.module';
import { MainModelModule } from './graphql/main_model/main_model.module';
import { CampaignSubmit } from '../entity/entities/CampaignSubmit';
import { BoardModelModule } from './graphql/board_model/board_model.module';
import { PaymentModelModule } from './graphql/payment_model/payment_model.module';
import { Madein20ModelModule } from './graphql/madein20_model/madein20_model.module';
import { CommonModelModule } from './graphql/common_model/common_model.module';
// import { FirebaseModule } from './graphql/firebase/firebase.module';
import { SubmitModelModule } from './graphql/submit_model/submit_model.module';
import { ReviewModelModule } from './graphql/review_model/review_model.module';
import { Payment } from '../entity/entities/Payment';
import { BootpayModule } from './bootpay/bootpay.module';
import { Popup } from '../entity/entities/Popup';
import { Withdrawal } from '../entity/entities/Withdrawal';
import { CampaignReviewImage } from '../entity/entities/CampaignReviewImage';
import { Admin } from '../entity/entities/Admin';
// import { ApiplexModule } from './graphql/apiplex/apiplex.module';
import { ApiplexCallbackModule } from './apiplex_callback/apiplex_callback.module';
import { NotificationTalk } from '../entity/entities/NotificationTalk';
import { LogModelModule } from './graphql/log_model/log_model.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiplexModule } from './apiplex/apiplex.module';
// import { ApiplexModule } from './graphql/apiplex/apiplex.module';
import { EmailModule } from './email/email.module';
import { EmailTemplate } from '../entity/entities/EmailTemplate';
import { DeviceModelModule } from './graphql/device_model/device_model.module';
import { PushLog } from '../entity/entities/PushLog';
import { MemberChannelLog } from '../entity/entities/MemberChannelLog';
// import { ShortLinkModule } from './short_link/short_link.module';
import { ShortLink } from '../entity/entities/ShortLink';
import { CrawlerService } from './crawler/crawler.service';
import { CrawlerController } from './crawler/crawler.controller';
import { JwtService } from '@nestjs/jwt';
import { ShortLinkModule } from './graphql/short-link/short-link.module';
import { TripMoneyModule } from './graphql/trip-money/trip-money.module';
import { Trip } from 'entity/entities/Trip';
import { TripMemberCash } from 'entity/entities/TripMemberCash';
import { TripWithdrawal } from 'entity/entities/TripWithdrawal';
import { UploadModule } from './graphql/upload/upload.module';
import { BankBook } from 'entity/entities/BankBook';
import { WithDrawlerModule } from './graphql/with-drawal/with-drawal.module';
import { IdentificationCard } from 'entity/entities/IdentificationCard';
import { TripDenyReason } from 'entity/entities/TripDenyReason';
import { OcrModule } from './graphql/ocr/ocr.module';
import { MemberBlock } from '../entity/entities/MemberBlock';
import { PortfolioModule } from './graphql/portfolio/portfolio.module';
import { PortfolioInstagram } from '../entity/entities/PortfolioInstagram';
import { PortfolioYoutube } from '../entity/entities/PortfolioYoutube';
import { BlogAnalysis } from '../entity/entities/BlogAnalysis';
import { YoutubeAnalysis } from '../entity/entities/YoutubeAnalysis';
import { InstagramAnalysis } from '../entity/entities/InstagramAnalysis';
import { MemberProfile } from '../entity/entities/MemberProfile';
import { Waug } from '../entity/entities/Waug';
import { CookiePolicy } from '../entity/entities/CookiePolicy';
import { AiModule } from './graphql/ai/ai.module';
import { Button, ButtonHierarchy, ButtonResponse } from './graphql/ai/entities/buttons.entity';
import { Affiliate } from '../entity/entities/Affiliate';
import { MembersModule } from './members/members.module';
import { AffiliateModule } from './graphql/affiliate/affiliate.module';
import { TripMemberCashSummaryEntity } from '../entity/entities/TripMemberCashSummaryEntity';
import { TypeOrmCustomLogger } from './util/typeorm-logger';
import { AffiliateCategory } from '../entity/entities/AffiliateCategory';
import { Agoda } from '../entity/entities/Agoda';
import { WithDrawalPigModule } from './graphql/with-drawal-pig/with-drawal-pig.module';

@Module({
  imports: [
    CacheModule.register(),
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      // envFilePath: ['.development.env'],
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_SCHEMA,
      entities: [
        __dirname + '/../entity/entities/*{.ts,.js}',
        // Member,
        // MemberChannel,
        // Campaign,
        // CampaignItem,
        // CampaignImage,
        // Cate,
        // CateArea,
        // Partner,
        // CampaignReview,
        // Board,
        // BoardArticles,
        // CampaignRecent,
        // CampaignItemSchedule,
        // Config,
        // Banner,
        // Cate,
        // CateArea,
        // CampaignSubmit,
        // CampaignFav,
        // Payment,
        // Popup,
        // Withdrawal,
        // CampaignReviewImage,
        // Admin,
        // NotificationTalk,
        // EmailTemplate,
        // NotificationTalkCallBack,
        // CampaignSubmitBackup,
        // MemberDevice,
        // PushLog,
        // MemberChannelLog,
        // ShortLink,
        // Trip,
        // TripMemberCash,
        // TripWithdrawal,
        // TripDenyReason,
        // BankBook,
        // IdentificationCard,
        // MemberBlock,
        // PortfolioNaver,
        // PortfolioInstagram,
        // PortfolioYoutube,
        // BlogAnalysis,
        // YoutubeAnalysis,
        // InstagramAnalysis,
        // MemberProfile,
        // Waug,
        // CookiePolicy,
        // Button,
        // ButtonHierarchy,
        // ButtonResponse,
        // Affiliate,
        // ShortLink,
        // TripMemberCashSummaryEntity,
        // AffiliateCategory,
        // Agoda,
      ],
      synchronize: false,
      charset: 'utf8mb4',
      timezone: '+09:00', // KST 적용
      // extra: {
      //     charset: "utf8mb4"
      // },
      logging: true, // true로 설정해야 커스텀 로거가 작동함
      logger: new TypeOrmCustomLogger(), // 👈 이 부분이 핵심
    }),
    // 마이크로 서비스 계획시 사용
    // GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
    //     driver: ApolloGatewayDriver,
    //     gateway: {
    //         supergraphSdl: new IntrospectAndCompose({
    //             subgraphs: [
    //                 { name: 'user', url: 'http://localhost:3000/user' },
    //                 // { name: 'posts', url: 'http://localhost:3001/graphql' },
    //             ],
    //         }),
    //     },
    //     // typePaths: ['./**/*.graphql'],
    // }),

    GraphQLModule.forRoot({
      driver: ApolloDriver,
      debug: true,
      path: 'api/graphql',
      uploads: false,
      playground: true,
      introspection: true,
      include: [
        MemberModule,
        Campaign_gqlModule,
        Auth_gqlModule,
        AuthQlModelModule,
        BannerModelModule,
        CateModelModule,
        MainModelModule,
        BoardModelModule,
        PaymentModelModule,
        Madein20ModelModule,
        CommonModelModule,
        // FirebaseModule,
        SubmitModelModule,
        ReviewModelModule,
        ApiplexModule,
        DeviceModelModule,
        ShortLinkModule,
        TripMoneyModule,
        UploadModule,
        WithDrawlerModule,
        // ApiplexModule2
        OcrModule,
        PortfolioModule,
        AiModule,
        AffiliateModule,
        WithDrawalPigModule,
      ],
      typePaths: ['./**/*.graphql'],
      definitions: {
        customScalarTypeMapping: {
          BigInt: 'bigint',
          DateTime: 'Date',
        },
      },
      resolvers: {
        // Upload: Upload,
        BigInt: BigIntResolver,
        Date: DateResolver,
        DateTime: DateTimeResolver,
        // Upload: GraphQLUpload
      },
      // uploads: false,
      context: ({ req, connection }) => {
        //graphql에게 request를 요청할때 req안으로 jwt토큰이 담김
        if (req) {
          const user = req.headers.authorization;
          return { ...req, user };
        } else {
          return connection;
        }
      },
      formatError: (error) => {
        console.log(error);
        const graphQLFormattedError = {
          message: error.extensions?.exception?.response?.message || error.message,
          code: error.extensions?.originalError?.statusCode || 'SERVER_ERROR',
          name: error.extensions?.exception?.name || error.name,
        };
        return graphQLFormattedError;
      },
      // formatError: (formattedError, error) => {
      //     // Return a different error message
      //     if (
      //         formattedError.extensions.code ===
      //         ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED
      //     ) {
      //         return {
      //             ...formattedError,
      //             message: "Your query doesn't match the schema. Try double-checking it!",
      //         };
      //     }
      //
      //     // Otherwise return the formatted error. This error can also
      //     // be manipulated in other ways, as long as it's returned.
      //     return formattedError;
      // },
    }),
    // MembersModule,
    MembersModule,
    AuthModule,
    CampaignModule,
    UploadModule,
    ReviewModule,
    NoticeModule,
    MemberModule,
    Campaign_gqlModule,
    // AuthQlModule,
    Auth_gqlModule,
    AuthQlModelModule,
    BannerModelModule,
    CateModelModule,
    MainModelModule,
    BoardModelModule,
    PaymentModelModule,
    Madein20ModelModule,
    CommonModelModule,
    // FirebaseModule,
    SubmitModelModule,
    ReviewModelModule,
    BootpayModule,
    ApiplexModule,
    ApiplexCallbackModule,
    LogModelModule,
    SchedulerModule,
    EmailModule,
    DeviceModelModule,
    ShortLinkModule,
    TripMoneyModule,
    UploadModule,
    WithDrawlerModule,
    OcrModule,
    PortfolioModule,
    AiModule,
    AffiliateModule,
    WithDrawalPigModule,
  ],
  controllers: [AppController, CrawlerController],
  providers: [
    Logger,
    AppService,
    {
      provide: 'moment',
      useValue: moment,
    },
    CrawlerService,
    JwtService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    //    consumer.apply(graphqlUploadExpress()).forRoutes('graphql');
    consumer
      .apply((req, res, next) => {
        res.setHeader('Content-Type', 'multipart/form-data; charset=utf-8');
        next();
      })
      .forRoutes('*');
  }
}
