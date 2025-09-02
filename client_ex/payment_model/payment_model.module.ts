import { Module } from '@nestjs/common';
import { PaymentModelService } from './payment_model.service';
import { SubmitModelService } from '../submit_model/submit_model.service';
import { PaymentModelResolver } from './payment_model.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignSubmit } from '../../../entity/entities/CampaignSubmit';
import { Campaign } from '../../../entity/entities/Campaign';
import { CampaignItem } from '../../../entity/entities/CampaignItem';
import { CampaignItemSchedule } from '../../../entity/entities/CampaignItemSchedule';
import { JwtService } from '@nestjs/jwt';
import { Payment } from '../../../entity/entities/Payment';
import { Member } from '../../../entity/entities/Member';
import { ApiplexService } from '../apiplex/apiplex.service';
import { NotificationTalk } from '../../../entity/entities/NotificationTalk';
import { Admin } from '../../../entity/entities/Admin';
import { Partner } from '../../../entity/entities/Partner';
import { MemberChannel } from '../../../entity/entities/MemberChannel';
import { MembersService } from '../member_model/member.service';
import { CampaignReview } from '../../../entity/entities/CampaignReview';
import { Config } from '../../../entity/entities/Config';
import { CampaignService } from '../../campaign/campaign.service';
import { CampaignImage } from '../../../entity/entities/CampaignImage';
import { Cate } from '../../../entity/entities/Cate';
import { CateArea } from '../../../entity/entities/CateArea';
import { CampaignRecent } from '../../../entity/entities/CampaignRecent';
import { CampaignFav } from '../../../entity/entities/CampaignFav';
import { EmailService } from '../../email/email.service';
import { EmailTemplate } from '../../../entity/entities/EmailTemplate';
import { CampaignSubmitBackup } from '../../../entity/entities/CampaignSubmitBackup';
import { MemberDevice } from '../../../entity/entities/MemberDevice';
import { PushLog } from '../../../entity/entities/PushLog';
import { MemberChannelLog } from '../../../entity/entities/MemberChannelLog';
import { MemberBlock } from '../../../entity/entities/MemberBlock';
import { BlogAnalysis } from '../../../entity/entities/BlogAnalysis';
import { InstagramAnalysis } from '../../../entity/entities/InstagramAnalysis';
import { YoutubeAnalysis } from '../../../entity/entities/YoutubeAnalysis';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignImage,
      CampaignItem,
      CampaignItemSchedule,
      CampaignSubmit,
      Payment,
      Member,
      MemberChannel,
      NotificationTalk,
      Admin,
      Partner,
      CampaignReview,
      Config,
      CampaignSubmit,
      Cate,
      CateArea,
      CampaignRecent,
      CampaignFav,
      EmailTemplate,
      CampaignSubmitBackup,
      MemberDevice,
      PushLog,
      MemberChannelLog,
      MemberBlock,
      BlogAnalysis,
      InstagramAnalysis,
      YoutubeAnalysis,
    ]),
  ],
  providers: [PaymentModelResolver, PaymentModelService, JwtService, SubmitModelService,
    ApiplexService, MembersService, CampaignService, EmailService],
})
export class PaymentModelModule {
}
