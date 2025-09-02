import { Module } from '@nestjs/common';
import { TripMoneyService } from './trip-money.service';
import { TripMoneyResolver } from './trip-money.resolver';
import { Trip } from '../../../entity/entities/Trip';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembersService } from '../member_model/member.service';
import { MemberModule } from '../member_model/member.module';
import { JwtService } from '@nestjs/jwt';
import { TripMemberCash } from '../../../entity/entities/TripMemberCash';
import { TripWithdrawal } from 'entity/entities/TripWithdrawal';
import { TripDenyReason } from 'entity/entities/TripDenyReason';
import { Waug } from '../../../entity/entities/Waug';
import { Config } from 'entity/entities/Config';
import { Agoda } from '../../../entity/entities/Agoda';
import { LinkpriceLog } from '../../../entity/entities/LinkpriceLog';
import { RecommendMemberCash } from '../../../entity/entities/RecommendMemberCash';
import { RecommendWithdrawal } from '../../../entity/entities/RecommendWithdrawal';
import { VanillaplantUserProfit } from '../../../entity/entities/VanillaplantUserProfit';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      TripMemberCash,
      TripWithdrawal,
      TripDenyReason,
      Config,
      Waug,
      Agoda,
      LinkpriceLog,
      RecommendMemberCash,
      RecommendWithdrawal,
      VanillaplantUserProfit,
    ]),
    MemberModule,
  ],
  providers: [TripMoneyResolver, TripMoneyService, MembersService, JwtService],
})
export class TripMoneyModule {}
