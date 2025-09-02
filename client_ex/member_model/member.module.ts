import { Module } from '@nestjs/common';
import { MemberResolver } from './member.resolver';
import { MembersService } from './member.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../../../entity/entities/Member';
import { MemberChannel } from '../../../entity/entities/MemberChannel';
import { CampaignReview } from '../../../entity/entities/CampaignReview';
import { Config } from '../../../entity/entities/Config';
import { JwtService } from '@nestjs/jwt';
import { Partner } from '../../../entity/entities/Partner';
import { Madein20ModelService } from '../madein20_model/madein20_model.service';
import { Admin } from '../../../entity/entities/Admin';
import { Campaign } from '../../../entity/entities/Campaign';
import { CampaignItem } from '../../../entity/entities/CampaignItem';
import { ApiplexService } from '../apiplex/apiplex.service';
import { NotificationTalk } from '../../../entity/entities/NotificationTalk';
import { MemberDevice } from '../../../entity/entities/MemberDevice';
import { PushLog } from '../../../entity/entities/PushLog';
import { MemberChannelLog } from '../../../entity/entities/MemberChannelLog';
import { MemberBlock } from '../../../entity/entities/MemberBlock';
import { BlogAnalysis } from '../../../entity/entities/BlogAnalysis';
import { InstagramAnalysis } from '../../../entity/entities/InstagramAnalysis';
import { YoutubeAnalysis } from '../../../entity/entities/YoutubeAnalysis';

@Module({
  imports: [TypeOrmModule.forFeature([Member, MemberChannel,
    CampaignReview, Config, Partner, Admin, Campaign, CampaignItem, NotificationTalk,
    MemberDevice, PushLog, MemberChannelLog, MemberBlock, BlogAnalysis, InstagramAnalysis, YoutubeAnalysis,
  ])],
  providers: [MemberResolver, MembersService, JwtService, Madein20ModelService, ApiplexService],
  exports: [MembersService, TypeOrmModule],
})
export class MemberModule {
}
