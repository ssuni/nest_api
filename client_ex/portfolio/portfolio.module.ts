import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioResolver } from './portfolio.resolver';
import { UploadModule } from '../upload/upload.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripWithdrawal } from '../../../entity/entities/TripWithdrawal';
import { Member } from '../../../entity/entities/Member';
import { PortfolioNaver } from '../../../entity/entities/PortfolioNaver';
import { JwtService } from '@nestjs/jwt';
import { OcrService } from '../ocr/ocr.service';
import { HttpModule } from '@nestjs/axios';
import { PortfolioInstagram } from '../../../entity/entities/PortfolioInstagram';
import { PortfolioYoutube } from '../../../entity/entities/PortfolioYoutube';
import { CampaignSubmit } from '../../../entity/entities/CampaignSubmit';
import { BlogAnalysis } from '../../../entity/entities/BlogAnalysis';
import { InstagramAnalysis } from '../../../entity/entities/InstagramAnalysis';
import { YoutubeAnalysis } from '../../../entity/entities/YoutubeAnalysis';
import { MemberProfile } from '../../../entity/entities/MemberProfile';
import { MembersService } from '../member_model/member.service';
import { MemberChannel } from '../../../entity/entities/MemberChannel';
import { CampaignReview } from '../../../entity/entities/CampaignReview';
import { Config } from '../../../entity/entities/Config';
import { Partner } from '../../../entity/entities/Partner';
import { MemberDevice } from '../../../entity/entities/MemberDevice';
import { PushLog } from '../../../entity/entities/PushLog';
import { MemberChannelLog } from '../../../entity/entities/MemberChannelLog';
import { MemberBlock } from '../../../entity/entities/MemberBlock';

@Module({
  imports: [
    TypeOrmModule.forFeature([TripWithdrawal, Member, PortfolioNaver,
      PortfolioInstagram, PortfolioYoutube, CampaignSubmit, BlogAnalysis,
      InstagramAnalysis, YoutubeAnalysis, MemberProfile, MemberChannel,
      CampaignReview, Config, Partner, MemberDevice, PushLog, MemberChannelLog,
      MemberBlock,
    ]),
    UploadModule, HttpModule,
  ],
  providers: [PortfolioResolver, PortfolioService, JwtService, OcrService, MembersService],
})
export class PortfolioModule {
}
