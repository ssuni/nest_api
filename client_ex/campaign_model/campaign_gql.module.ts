import { Module } from '@nestjs/common';
import { CampaignResolver } from './campaign.resolver';
import { CampaignService } from '../../campaign/campaign.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../../../entity/entities/Campaign';
import { JwtService } from '@nestjs/jwt';
import { CampaignItem } from '../../../entity/entities/CampaignItem';
import { CampaignImage } from '../../../entity/entities/CampaignImage';
import { Cate } from '../../../entity/entities/Cate';
import { CateArea } from '../../../entity/entities/CateArea';
import { Partner } from '../../../entity/entities/Partner';
import { CampaignReview } from '../../../entity/entities/CampaignReview';
import { CampaignRecent } from '../../../entity/entities/CampaignRecent';
import { CampaignItemSchedule } from '../../../entity/entities/CampaignItemSchedule';
import { CampaignFav } from '../../../entity/entities/CampaignFav';
import { CampaignSubmit } from '../../../entity/entities/CampaignSubmit';
import { Member } from '../../../entity/entities/Member';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignItem,
      CampaignImage,
      Cate,
      CateArea,
      Partner,
      CampaignReview,
      CampaignRecent,
      CampaignItemSchedule,
      CampaignFav,
      CampaignSubmit,
      Member,
    ]),
  ],
  providers: [CampaignResolver, CampaignService, JwtService],
})
export class Campaign_gqlModule {}
