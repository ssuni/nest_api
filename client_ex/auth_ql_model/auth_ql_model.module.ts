import { Module } from '@nestjs/common';
import { AuthQlModelService } from './auth_ql_model.service';
import { AuthQlModelResolver } from './auth_ql_model.resolver';
import { MembersService } from '../member_model/member.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../../../entity/entities/Member';
import { Campaign } from '../../../entity/entities/Campaign';
import { CampaignItem } from '../../../entity/entities/CampaignItem';
import { CampaignImage } from '../../../entity/entities/CampaignImage';
import { Cate } from '../../../entity/entities/Cate';
import { CateArea } from '../../../entity/entities/CateArea';
import { Partner } from '../../../entity/entities/Partner';
import { CampaignReview } from '../../../entity/entities/CampaignReview';
import { CampaignRecent } from '../../../entity/entities/CampaignRecent';
import { JwtService } from '@nestjs/jwt';
import { MemberChannel } from '../../../entity/entities/MemberChannel';
import { Config } from '../../../entity/entities/Config';
import { Withdrawal } from '../../../entity/entities/Withdrawal';
import { Madein20ModelService } from '../madein20_model/madein20_model.service';
import { Admin } from '../../../entity/entities/Admin';
import { ApiplexService } from '../apiplex/apiplex.service';
import { NotificationTalk } from '../../../entity/entities/NotificationTalk';
import { MemberDevice } from '../../../entity/entities/MemberDevice';
import { PushLog } from '../../../entity/entities/PushLog';
import { MemberChannelLog } from '../../../entity/entities/MemberChannelLog';
import { MemberBlock } from '../../../entity/entities/MemberBlock';
import { BlogAnalysis } from '../../../entity/entities/BlogAnalysis';
import { InstagramAnalysis } from '../../../entity/entities/InstagramAnalysis';
import { YoutubeAnalysis } from '../../../entity/entities/YoutubeAnalysis';
import { Trip } from '../../../entity/entities/Trip';
import { Waug } from '../../../entity/entities/Waug';
import { LinkpriceLog } from '../../../entity/entities/LinkpriceLog';
import { TripMemberCash } from '../../../entity/entities/TripMemberCash';
import { Agoda } from '../../../entity/entities/Agoda';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Member,
      MemberChannel,
      Campaign,
      CampaignItem,
      CampaignImage,
      Cate,
      CateArea,
      Partner,
      CampaignReview,
      CampaignRecent,
      Config,
      Withdrawal,
      Admin,
      NotificationTalk,
      MemberDevice,
      PushLog,
      MemberChannelLog,
      MemberBlock,
      YoutubeAnalysis,
      InstagramAnalysis,
      BlogAnalysis,
      Trip,
      Waug,
      LinkpriceLog,
      TripMemberCash,
      Agoda,
    ]),
  ],
  providers: [
    AuthQlModelResolver,
    AuthQlModelService,
    MembersService,
    JwtService,
    Madein20ModelService,
    ApiplexService,
  ],
})
export class AuthQlModelModule {}
