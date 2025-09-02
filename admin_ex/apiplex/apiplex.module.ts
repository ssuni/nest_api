import { Module } from '@nestjs/common';
import { MemberVerify } from '../../entity/entities/MemberVerify';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiplexController } from './apiplex.controller';
import { ApiplexService } from './apiplex.service';
import { Member } from '../../entity/entities/Member';
import { MemberChannel } from '../../entity/entities/MemberChannel';
import { Admin } from '../../entity/entities/Admin';
import { Partner } from '../../entity/entities/Partner';
import { NotificationTalk } from '../../entity/entities/NotificationTalk';
import { PigMemberCash } from '../../entity/secondary_entities/PigMemberCash';
import { NotificationTalk as WairiNotificationTalk } from '../../entity/secondary_entities/NotificationTalk';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberVerify, Member, MemberChannel, Admin, Partner, NotificationTalk]),
    TypeOrmModule.forFeature([PigMemberCash, WairiNotificationTalk], 'secondaryConnection'),
  ],
  controllers: [ApiplexController],
  providers: [ApiplexService],
  exports: [ApiplexService],
})
export class ApiplexModule {}
