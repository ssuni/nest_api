import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { MembersService } from './member.service';

import { HttpException, Logger, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/GqlAuthGuard';
import { bufferToString, changeInterestsIndex, changeInterestsText, FROM_UNIXTIME_JS } from '../../util/common';
import { FetchPaginationInput } from '../../members/dto/fetch-pagination.input';
import { AuthUser } from '../../auth/auth-user.decorator';
import { Member } from '../../../entity/entities/Member';
import { Madein20ModelService } from '../madein20_model/madein20_model.service';
import { ApiplexService } from '../apiplex/apiplex.service';

class CeateMemberChannelInput {
  type: number;
  link: string;
  interests: string;
  channelName?: string;
}

class UpdateMemberChannelInput {
  idx: number;
  type: number;
  link: string;
  interests: number;
  channelName?: string;
}


class ReauthorizationInput {
  idx: number;
}

@Resolver('Member')
export class MemberResolver {
  private readonly logger = new Logger(MemberResolver.name);

  constructor(
    private readonly membersService: MembersService,
    private readonly madein20ModelService: Madein20ModelService,
    private readonly apiPlexService: ApiplexService,
  ) {
    console.log('MemberResolver');
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getAllMember(
    // @Args() args?: FetchPaginationInput
    @Args() { skip, take, title }: FetchPaginationInput,
  ) {
    try {
      console.log(skip, take);

      let data = await this.membersService.findAll(skip, take);

      data.forEach((element, index) => {
        if (element.regdate) {
          //time -> datetime 형식으로 변환
          data[index].regdate = new Date(element.regdate * 1000).toISOString().slice(0, 19).replace('T', ' ');
          data[index].lastUpdate = new Date(element.lastUpdate * 1000).toISOString().slice(0, 19).replace('T', ' ');
        }

        // bufferToString(element);
      });
      // console.log(data)
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMember(@Args('id', { type: () => Int }) id: number) {
    try {
      let data = await this.membersService.findOne(id);

      if (data) {
        data = bufferToString(data);
      }

      if (data == undefined) {
        throw new Error('Not Found');
      }
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMemberByEmail(@Args('email', { type: () => String }) email: string) {
    try {
      const data = await this.membersService.findByEmail(email);
      console.log(data.regdate);
      if (data == undefined) {
        throw new Error('Not Found');
      }
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Mutation((returns) => Member)
  @UseGuards(GqlAuthGuard)
  async createMemberChannel(@AuthUser() authUser: Member,
                            @Args('createMemberChannelInput') createMemberChannelInput: CeateMemberChannelInput,
  ) {
    try {
      let data = {
        memberIdx: authUser.idx,
        type: createMemberChannelInput.type,
        link: createMemberChannelInput.link,
        interests: changeInterestsIndex(createMemberChannelInput.interests),
        channelName: '',
      };
      if (createMemberChannelInput.type == 9) {
        data['channelName'] = createMemberChannelInput.channelName;
      }

      const checkChannel = await this.membersService.checkMemberChannel(data);

      if (checkChannel) {
        return {
          code: 500,
          message: '이미 등록된 채널이 있습니다.',
        };
      }

      const createChannel = await this.membersService.setMemberChannel(data);
      console.log('=>(member.resolver.ts:138) createChannel', createChannel);

      const channelIdx = createChannel.idx;
      if (channelIdx == undefined) {
        return {
          code: 500,
          message: '채널 등록 실패',
        };
      }
      let getChannel = await this.membersService.getMemberChannel(channelIdx);
      if (getChannel) {
        getChannel = bufferToString(getChannel);
      }
      const member = await this.membersService.getMember(authUser.idx);
      //Todo : 알림톡 발송
      if (member.phone) {
        let param = {
          '이름': member.name ? member.name : '회원',
          '채널주소': createMemberChannelInput.link,
        };

        await this.apiPlexService.sendUserAlimtalk('1EHu0hjNSYvP', member.phone, param);
      }

      //Todo GPT 분석
      this.membersService.setAnalysisChannel(createMemberChannelInput, authUser);

      return {
        code: 200,
        message: '채널 등록 성공',
        idx: channelIdx,
        type: getChannel.type,
        link: getChannel.link,
        interests: changeInterestsText(getChannel.interests),
        channelName: getChannel.typeText,
        regdate: FROM_UNIXTIME_JS(getChannel.regdate),
        level: getChannel.level,
      };
    } catch (error) {
      console.log('=>(member.resolver.ts:148) error', error);
      throw new HttpException(error.message, 500);
    }
  }

  @Mutation((returns) => Member)
  @UseGuards(GqlAuthGuard)
  async updateMemberChannel(@AuthUser() authUser: Member,
                            @Args('updateMemberChannelInput') updateMemberChannelInput: UpdateMemberChannelInput,
  ) {
    try {
      let data = {
        idx: updateMemberChannelInput.idx,
        memberIdx: authUser.idx,
        type: updateMemberChannelInput.type,
        link: updateMemberChannelInput.link,
        interests: updateMemberChannelInput.interests,
        channelName: '',
      };

      //getchannel
      let getChannel = await this.membersService.getMemberChannel(updateMemberChannelInput.idx);

      if (updateMemberChannelInput.type == 9) {
        data['channelName'] = updateMemberChannelInput.channelName;
      }

      let channel;

      if (getChannel.link !== updateMemberChannelInput.link) {
        channel = await this.membersService.updateMemberChannelLink(data);
      } else {
        channel = await this.membersService.updateMemberChannel(data);
      }

      if (channel.affected > 0) {
        let getChannel = await this.membersService.getMemberChannel(updateMemberChannelInput.idx);
        if (getChannel) {
          getChannel = bufferToString(getChannel);
        }

        //개행문자 \n 추가
        let html = '';
        updateMemberChannelInput.channelName ? html += `채널명 : ${updateMemberChannelInput.channelName} \n` : '';
        updateMemberChannelInput.link ? html += `   링크 : ${updateMemberChannelInput.link} \n` : '';
        updateMemberChannelInput.interests ? html += `   관심분야 : ${changeInterestsText(updateMemberChannelInput.interests)} \n` : '';

        const channelLog = await this.membersService.memberChannelLog(data, html);

        let param = {
          '이름': authUser.username,
          '변경내용': html,
        };

        // await this.madein20ModelService.sendUserAlimtalk(authUser.phone, param, 'kjR290Pm0Xac0NzLZNU2');
        await this.apiPlexService.sendUserAlimtalk('kjR290Pm0Xac', authUser.phone, param);

        return {
          code: 200,
          message: '채널 수정 성공',
          idx: updateMemberChannelInput.idx,
          type: getChannel.type,
          link: getChannel.link,
          interests: changeInterestsText(getChannel.interests),
          channelName: getChannel.typeText,
          regdate: FROM_UNIXTIME_JS(getChannel.regdate),
          level: getChannel.level,
        };
      } else {
        return {
          code: 500,
          message: '채널 수정 실패',
          idx: updateMemberChannelInput.idx,
        };
      }
    } catch (error) {
      throw new HttpException(error.message, 500);
    }
  }

  @Mutation((returns) => Member)
  @UseGuards(GqlAuthGuard)
  async deleteMemberChannel(@AuthUser() authUser: Member,
                            @Args('channelIdx', { type: () => Int }) channelIdx: number,
  ) {
    try {
      console.log('=>(member.resolver.ts:140) channelIdx', channelIdx);
      const data = {
        memberIdx: authUser.idx,
        channelIdx: channelIdx,
      };
      const oldChannel = await this.membersService.getMemberChannel(channelIdx);
      const channel = await this.membersService.deleteMemberChannel(data);
      console.log('-> channel', channel);
      if (channel.affected > 0) {
        //분석 정보 삭제
        const oldData = {
          memberIdx: authUser.idx,
          type: oldChannel.type,
        };
        this.membersService.deleteAnalysisChannel(oldData);
        return {
          code: 200,
          message: '채널 삭제 성공',
          idx: channelIdx,
        };
      } else {
        return {
          code: 500,
          message: '채널 삭제 실패',
          idx: channelIdx,
        };
      }
    } catch (error) {
      throw new HttpException(error.message, 500);
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMemberChannel(@AuthUser() authUser: Member) {
    try {
      let data = await this.membersService.getMemberChannelAll(authUser.idx);
      // let data = await this.membersService.getMemberChannelAll(15807);
      if (data.length > 0) {
        data = bufferToString(data);
      }
      data.forEach((element, index) => {
        if (element.regdate) {
          //time -> datetime 형식으로 변환
          data[index].regdate = FROM_UNIXTIME_JS(element.regdate);
        }
        data[index].interests = changeInterestsText(element.interests);
        data[index].channelName = element.typeText;
      });
      return data;

    } catch (error) {
      console.log('=>(member.resolver.ts:246) error', error);
      throw new HttpException(error.message, 500);
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMemberPushLogs(
    @Args('deviceId', { type: () => Int }) deviceId: number,
    @AuthUser() authUser: Member,
  ) {
    try {
      let data = await this.membersService.getMemberPushLogs(authUser.idx, deviceId);
      return data;
    } catch (error) {
      console.log('=>(member.resolver.ts:246) error', error);
      throw new HttpException(error.message, 500);
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getIsReadCount(
    @AuthUser() authUser: Member,
    @Args('idx', { type: () => Int }) idx: number,
  ) {
    try {
      let data = await this.membersService.getIsReadCount(authUser.idx);
      return { count: data };
    } catch (error) {
      console.log('=>(member.resolver.ts:246) error', error);
      throw new HttpException(error.message, 500);
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getNotification(
    @AuthUser() authUser: Member,
    @Args('idx', { type: () => Int }) idx: number,
    @Args('device_id', { type: () => String }) device_id: string,
  ) {
    try {
      let data = await this.membersService.getNotification(authUser.idx, device_id);
      return data;
    } catch (error) {
      console.log('=>(member.resolver.ts:246) error', error);
      throw new HttpException(error.message, 500);
    }
  }

  @Mutation('updateIsRead')
  @UseGuards(GqlAuthGuard)
  async updateIsRead(
    @AuthUser() authUser: Member,
    @Args('idx', { type: () => Int }) idx: number,
  ) {
    try {
      const data = {
        memberIdx: authUser.idx,
        idx: idx,
      };
      const result = await this.membersService.updateIsRead(data);
      if (result.affected > 0) {
        return {
          code: 200,
          message: '읽음 처리 성공',
        };
      } else {
        return {
          code: 500,
          message: '읽음 처리 실패',
        };
      }
    } catch (error) {
      throw new HttpException(error.message, 500);
    }
  }

  @Mutation('updateIsReadAll')
  @UseGuards(GqlAuthGuard)
  async updateIsReadAll(
    @AuthUser() authUser: Member,
    @Args('idx', { type: () => Int }) idx: number,
  ) {
    try {
      const data = {
        memberIdx: authUser.idx,
      };
      const result = await this.membersService.updateIsReadAll(data);
      if (result.affected > 0) {
        return {
          code: 200,
          message: '읽음 처리 성공',
        };
      } else {
        return {
          code: 500,
          message: '읽음 처리 실패',
        };
      }
    } catch (error) {
      throw new HttpException(error.message, 500);
    }
  }

  @Mutation('updateNotificationSetting')
  @UseGuards(GqlAuthGuard)
  async updateNotificationSetting(
    @AuthUser() authUser: Member,
    @Args('event', { type: () => Boolean }) event: boolean,
    @Args('action', { type: () => Boolean }) action: boolean,
    @Args('night', { type: () => Boolean }) night: boolean,
    @Args('agree', { type: () => Boolean }) agree: boolean,
    @Args('device_id', { type: () => String }) device_id: String,
  ) {

    try {
      const data = {
        device_id: device_id,
        memberIdx: authUser.idx,
        event: event,
        action: action,
        night: night,
        agree: agree,
      };
      console.log('=>(member.resolver.ts:360) data', data);
      const result = await this.membersService.updateNotificationSetting(data);
      if (result.affected > 0) {
        this.logger.debug('updateNotificationSetting: ' + JSON.stringify(data));
        return {
          code: 200,
          message: '알림 설정 변경 성공',
        };
      } else {
        return {
          code: 500,
          message: '알림 설정 변경 실패',
        };
      }
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  @Mutation()
  @UseGuards(GqlAuthGuard)
  async reauthorization(
    @AuthUser() authUser: Member,
    @Args('reauthorizationInput') reauthorizationInput: ReauthorizationInput,
  ) {
    console.log('=>(member.resolver.ts:434) ', reauthorizationInput);
    return {
      code: 200,
    };
  }
}
