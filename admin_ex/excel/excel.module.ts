import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelController } from './excel.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Member } from '../../entity/entities/Member';
import { MemberChannel } from '../../entity/entities/MemberChannel';
import { Campaign } from '../../entity/entities/Campaign';
import { CampaignImage } from '../../entity/entities/CampaignImage';
import { CampaignItem } from '../../entity/entities/CampaignItem';
import { CampaignItemImage } from '../../entity/entities/CampaignItemImage';
import { CampaignSubmit } from '../../entity/entities/CampaignSubmit';
import { CampaignItemSchedule } from '../../entity/entities/CampaignItemSchedule';
import { CampaignReview } from '../../entity/entities/CampaignReview';
import { Cate } from '../../entity/entities/Cate';
import { CateArea } from '../../entity/entities/CateArea';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Member,
      MemberChannel,
      Campaign,
      CampaignImage,
      CampaignItem,
      CampaignItemImage,
      CampaignSubmit,
      CampaignItemSchedule,
      CampaignReview,
      Cate,
      CateArea,
    ]),
  ],
  controllers: [ExcelController],
  providers: [ExcelService, JwtService],
})
export class ExcelModule {}
