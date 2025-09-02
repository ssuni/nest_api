import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin_dashboard.service';
import { AdminDashboardController } from './admin_dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Admin } from '../../entity/entities/Admin';
import { Member } from '../../entity/entities/Member';
import { MemberChannel } from '../../entity/entities/MemberChannel';
import { Campaign } from '../../entity/entities/Campaign';
import { CampaignItem } from '../../entity/entities/CampaignItem';
import { CampaignSubmit } from '../../entity/entities/CampaignSubmit';
import { CampaignItemSchedule } from '../../entity/entities/CampaignItemSchedule';
import { Partner } from '../../entity/entities/Partner';
import { ApiplexService } from '../apiplex/apiplex.service';
import { NotificationTalk } from '../../entity/entities/NotificationTalk';
import { ShortLink } from '../../entity/entities/ShortLink';
import { MemberBlock } from '../../entity/entities/MemberBlock';
import { PigMemberCash } from '../../entity/secondary_entities/PigMemberCash';
import { NotificationTalk as WairiNotificationTalk } from '../../entity/secondary_entities/NotificationTalk';
import { Member as WairiMember } from '../../entity/secondary_entities/Member';
import { TripMemberCash } from '../../entity/entities/TripMemberCash';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      Member,
      MemberChannel,
      Campaign,
      CampaignItem,
      CampaignSubmit,
      CampaignItemSchedule,
      Partner,
      NotificationTalk,
      ShortLink,
      MemberBlock,
      TripMemberCash,
    ]),
    TypeOrmModule.forFeature([PigMemberCash, WairiNotificationTalk, WairiMember], 'secondaryConnection'),
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService, JwtService, ApiplexService],
})
export class AdminDashboardModule {}
