import { Module } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../../entity/entities/Member';
import { Trip } from '../../entity/entities/Trip';
import { TripMemberCash } from '../../entity/entities/TripMemberCash';
import { TripWithdrawal } from '../../entity/entities/TripWithdrawal';
import { Waug } from '../../entity/entities/Waug';
import { ShortLink } from '../../entity/entities/ShortLink';
import { AffiliateOrderType } from '../../entity/entities/AffiliateOrderType';
import { Affiliate } from '../../entity/entities/Affiliate';
import { AwsService } from '../aws/aws.service';
import { AffiliateCategory } from '../../entity/entities/AffiliateCategory';
import { TripDenyReason } from '../../entity/entities/TripDenyReason';
import { AffiliateSvg } from '../../entity/entities/AffiliateSvg';
import { AffiliateImage } from '../../entity/entities/AffiliateImage';
import { Agoda } from '../../entity/entities/Agoda';
import { Config } from '../../entity/entities/Config';
import { LinkpriceLog } from '../../entity/entities/LinkpriceLog';
import { MemberDevice } from '../../entity/entities/MemberDevice';
import { PushLog } from '../../entity/entities/PushLog';
import { FcmModule } from '../fcm/fcm.module';
import { ApiplexModule } from '../apiplex/apiplex.module';
import { MembershipManagementModule } from '../membership_management/membership_management.module';
import { PigMemberCash } from '../../entity/secondary_entities/PigMemberCash';
import { RecommendMemberCash } from '../../entity/entities/RecommendMemberCash';
import { RecommendWithdrawal } from '../../entity/entities/RecommendWithdrawal';
import { WairiFcmModule } from '../wairi_fcm/wairi_fcm.module'; // 추가된 엔티티

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Affiliate,
      Member,
      Trip,
      TripMemberCash,
      TripWithdrawal,
      Waug,
      ShortLink,
      AffiliateOrderType,
      AffiliateCategory,
      TripDenyReason,
      AffiliateSvg,
      AffiliateImage,
      Agoda,
      Config,
      LinkpriceLog,
      MemberDevice, // MemberDevice 엔티티 추가
      PushLog, // PushLog 엔티티 추가
      RecommendMemberCash,
      RecommendWithdrawal,
    ]),
    TypeOrmModule.forFeature([PigMemberCash], 'secondaryConnection'), // ✅ 추가
    FcmModule,
    WairiFcmModule,
    ApiplexModule,
    MembershipManagementModule,
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService, AwsService],
  exports: [AffiliateService, TypeOrmModule.forFeature([Affiliate, AffiliateCategory, AffiliateSvg, AffiliateImage])],
})
export class AffiliateModule {}
