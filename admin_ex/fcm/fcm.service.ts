import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { MemberDevice } from '../../entity/entities/MemberDevice';
import { Member } from '../../entity/entities/Member';
import { FcmTextTransform } from '../../entity/entities/FcmTextTransform';
import { PushLog } from '../../entity/entities/PushLog';
import { Affiliate } from '../../entity/entities/Affiliate';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { textTransform } from '../util/util';
@Injectable()
export class FcmService {
  constructor(
    @Inject('FIREBASE_APP') private readonly app: admin.app.App,
    private configService: ConfigService,
    @InjectRepository(MemberDevice)
    private readonly memberDeviceRepository: Repository<MemberDevice>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(FcmTextTransform)
    private readonly fcmTextTransformRepository: Repository<FcmTextTransform>,
    @InjectRepository(PushLog)
    private readonly pushLogRepository: Repository<PushLog>,
    @InjectRepository(Affiliate)
    private readonly affiliateRepository: Repository<Affiliate>,
  ) {}

  async sendFcmMessage(data: any) {
    if (!data.token) {
      console.error('[FCM ERROR] Missing device token:', data);
      return;
    }

    const message: admin.messaging.Message = {
      data: {
        title: data.title,
        body: data.body,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        room: data.room,
        roomId: data.roomId,
      },
      android: {
        priority: 'high', // 'high' 또는 'normal'만 사용 가능
      },
      apns: {
        payload: {
          /*aps: {
            alert: {
              title: data.title,
              body: data.body,
            },
            sound: 'default', // 또는 'ping.aiff'
          },*/
          aps: {
            alert: {
              title: data.title,
              body: data.body,
            },
            sound: 'default', // 또는 'ping.aiff'
          },
        },
        headers: {
          'apns-push-type': 'alert',
          // 'apns-push-type': 'background',
          'apns-priority': '10', // Must be `5` when `contentAvailable` is set to true.
          'apns-topic': 'io.flutter.plugins.firebase.messaging', // bundle identifier
        },
      },
      token: data.token,
    };
    // const message: admin.messaging.Message = {
    //   data: {
    //     title: data.title,
    //     body: data.body,
    //     click_action: 'FLUTTER_NOTIFICATION_CLICK',
    //     room: data.room,
    //     roomId: data.roomId,
    //   },
    //   android: {
    //     priority: 'high', // 'high' 또는 'normal'만 사용 가능
    //   },
    //   apns: {
    //     payload: {
    //       aps: {
    //         contentAvailable: true,
    //       },
    //     },
    //     headers: {
    //       'apns-push-type': 'alert',
    //       // 'apns-push-type': 'background',
    //       'apns-priority': '10', // Must be `5` when `contentAvailable` is set to true.
    //       'apns-topic': 'io.flutter.plugins.firebase.messaging', // bundle identifier
    //     },
    //   },
    //   token: data.token,
    // };
    try {
      // Send a message
      const response = await this.app.messaging().send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (e) {
      console.error('Error sending message:', e);
      new HttpException(e.message, e.status);
    }
  }

  async sendFcmMessageBatch(dataList: any[]) {
    const BATCH_SIZE = 500;
    const results: { success: any[]; failed: { error: any; data: any }[] } = {
      success: [],
      failed: [],
    };

    for (let i = 0; i < dataList.length; i += BATCH_SIZE) {
      const batch = dataList.slice(i, i + BATCH_SIZE);

      // 병렬 전송: Promise.allSettled로 개별 메시지 처리
      const responses = await Promise.allSettled(
        batch.map((data) => {
          const message: admin.messaging.Message = {
            data: {
              title: data.title,
              body: data.body,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              room: data.room,
              roomId: data.roomId,
            },
            android: { priority: 'high' },
            // apns: {
            //   payload: { aps: { contentAvailable: true } },
            //   headers: {
            //     'apns-push-type': 'background',
            //     'apns-priority': '5',
            //     'apns-topic': 'io.flutter.plugins.firebase.messaging',
            //   },
            // },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: data.title,
                    body: data.body,
                  },
                  sound: 'default', // 또는 'ping.aiff'
                },
              },
              headers: {
                'apns-push-type': 'alert',
                // 'apns-push-type': 'background',
                'apns-priority': '10', // Must be `5` when `contentAvailable` is set to true.
                'apns-topic': 'io.flutter.plugins.firebase.messaging', // bundle identifier
              },
            },
            token: data.token,
          };
          return this.app.messaging().send(message);
        }),
      );

      // 성공/실패 결과 정리
      responses.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          results.success.push(res.value);
        } else {
          results.failed.push({
            error: res.reason,
            data: batch[idx], // 실패한 데이터 포함
          });
        }
      });
    }

    console.log(`✅ 성공: ${results.success.length}`);
    console.log(`❌ 실패: ${results.failed.length}`);
    if (results.failed.length > 0) {
      console.error('실패 토큰 목록 예시:', results.failed.slice(0, 5));
    }

    return results;
  }

  async sendFcmMessages(data: any) {
    let tokens: string[] = [];

    try {
      tokens = typeof data.token === 'string' ? JSON.parse(data.token) : data.token;

      if (!Array.isArray(tokens) || tokens.length === 0) {
        throw new Error('tokens must be a non-empty array');
      }
    } catch (e) {
      console.error('❌ Invalid token array:', e);
      throw new Error('Invalid token format. token must be a JSON string array or string[].');
    }

    const baseMessage = {
      data: {
        title: String(data.title ?? ''),
        body: String(data.body ?? ''),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        room: String(data.room ?? ''),
        roomId: String(data.roomId ?? ''),
      },
      android: { priority: 'high' as const },
      apns: {
        payload: { aps: { contentAvailable: true } },
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
          'apns-topic': 'io.flutter.plugins.firebase.messaging',
        },
      },
    };

    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(tokens.length / BATCH_SIZE);
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const tokenChunk = tokens.slice(i, i + BATCH_SIZE);
      const message: admin.messaging.MulticastMessage = {
        ...baseMessage,
        tokens: tokenChunk,
      };

      try {
        const response = await this.app.messaging().sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;
        console.log(
          `✅ [Batch ${i / BATCH_SIZE + 1}/${totalBatches}] Success: ${response.successCount}, Failure: ${response.failureCount}`,
        );
      } catch (err) {
        console.error(`❌ [Batch ${i / BATCH_SIZE + 1}] Error sending FCM:`, err);
        failureCount += tokenChunk.length;
      }
    }

    return {
      total: tokens.length,
      successCount,
      failureCount,
    };
  }

  // async sendFcmMessages(data: any) {
  //   let tokens: string[] = [];
  //
  //   try {
  //     tokens = typeof data.token === 'string' ? JSON.parse(data.token) : data.token;
  //
  //     if (!Array.isArray(tokens) || tokens.length === 0) {
  //       throw new Error('tokens must be a non-empty array');
  //     }
  //   } catch (e) {
  //     console.error('❌ Invalid token array:', e);
  //     throw new Error('Invalid token format. token must be a JSON string array or string[].');
  //   }
  //
  //   const message: admin.messaging.MulticastMessage = {
  //     data: {
  //       title: String(data.title ?? ''),
  //       body: String(data.body ?? ''),
  //       click_action: 'FLUTTER_NOTIFICATION_CLICK',
  //       room: String(data.room ?? ''),
  //       roomId: String(data.roomId ?? ''),
  //     },
  //     tokens,
  //     android: { priority: 'high' },
  //     apns: {
  //       payload: {
  //         aps: {
  //           contentAvailable: true,
  //         },
  //       },
  //       headers: {
  //         'apns-push-type': 'background',
  //         'apns-priority': '5',
  //         'apns-topic': 'io.flutter.plugins.firebase.messaging',
  //       },
  //     },
  //   };
  //
  //   const response = await this.app.messaging().sendEachForMulticast(message);
  //   console.log(`✅ FCM 전송 성공: ${response.successCount}/${tokens.length}`);
  //   return response;
  // }

  async deleteDeviceModel(data: any) {
    try {
      const result = [];
      for (let i = 0; i < data.device_id.length; i++) {
        const device_id = data.device_id[i];
        const deleteResult = await this.memberDeviceRepository
          .createQueryBuilder()
          .delete()
          .from(MemberDevice)
          .where('device_id = :device_id', { device_id })
          .execute();
        result.push(deleteResult);
      }
      return {
        message: 'success',
        result: result,
      };
    } catch (e) {
      console.log('=>(fcm.service.ts:45) e', e);
      new HttpException(e.message, e.status);
    }
  }

  async reservedDelivery(data: any) {
    try {
    } catch (e) {
      console.log('=>(fcm.service.ts:62) e', e);
      new HttpException(e.message, e.status);
    }
  }

  async proxySend(data: any) {
    try {
      console.log(data);
      const res = await axios.post('http://43.202.92.39:4000/fcm/send', data);
      return res.data;
    } catch (e) {
      console.log('=>(fcm.service.ts:70) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async proxySendMultiple(data: any) {
    try {
      console.log(data);
      const res = await axios.post('http://43.202.92.39:4000/fcm/send-multiple', data);
      console.log(res.data);
      return res.data;
    } catch (e) {
      console.log('=>(fcm.service.ts:70) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getMarketingMessageMemberList(ids, titleTransform, contentTransform, room, roomId) {
    try {
      //, 구분값으로 배열 생성
      if (typeof ids === 'string') {
        ids = ids.split(',').map((id) => id.trim());
      } else if (!Array.isArray(ids)) {
        throw new Error('ids must be a string or an array');
      }

      const members = await this.getMarketingDataIdx(ids);
      console.log(members);

      const template = await this.fcmTextTransformRepository.find();
      console.log(template);
      members.map((member) => {
        const data = {};

        // 템플릿에서 추가적인 키-값을 data에 병합
        template.forEach((item) => {
          const key = item.key;
          const valuePath = item.value; // 예: 'memberName'
          const value = member[valuePath]; // 단순히 member['memberName'], member['platform']
          if (value !== undefined && value !== null) {
            data[key] = String(value);
          }
        });

        console.log(data);

        const title = textTransform(titleTransform, data);
        member.title = title;
        const body = textTransform(contentTransform, data);
        member.body = body;
      });

      console.log(members);

      // 푸시 메시지 전송
      const results = await this.sendFcmMessageBatch(
        members.map((member) => ({
          title: member.title,
          body: member.body,
          token: member.device_token,
          room: room || '',
          roomId: roomId || '',
        })),
      );

      return {
        successCount: results.success.length,
        failureCount: results.failed.length,
        failedTokens: results.failed.map((f) => f.data.deviceId),
      };
    } catch (e) {
      console.log(e);
      throw new HttpException(e.message, e.status);
    }
  }

  private async getMarketingDataIdx(ids) {
    try {
      //event = 1
      const baseQuery = this.memberDeviceRepository.createQueryBuilder('memberDevice');
      baseQuery.leftJoin('memberDevice.member', 'member', 'member.idx = memberDevice.memberIdx');
      baseQuery.select([
        'member.idx AS memberIdx',
        'member.id AS memberId',
        'member.name AS memberName',
        'memberDevice.device_id AS deviceId',
        'memberDevice.device_token AS device_token',
        'memberDevice.platform AS platform',
        'member.agreeMsg AS agreeMsg',
        'memberDevice.event AS event',
        'memberDevice.action AS action',
        'memberDevice.night AS night',
        'memberDevice.created_at AS created_at',
      ]);
      baseQuery.where('memberDevice.event = :event', { event: 1 });
      baseQuery.andWhere('memberDevice.device_id IS NOT NULL');
      baseQuery.andWhere('member.agreeMsg = :agreeMsg', { agreeMsg: 1 });
      baseQuery.andWhere('member.id IN (:...ids)', { ids });

      const members = await baseQuery.getRawMany();
      return members;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async recommenderPush(data: any) {
    // FCM 알림 전송
    const member = await this.memberRepository.findOne({ where: { id: data.ouid } });
    // console.log('\x1b[97m\x1b[41m[CRITICAL] member:\x1b[0m', member);
    if (member) {
      // 회원의 디바이스 토큰이 있는 경우에만 FCM 메시지 전송
      const tokenList = await this.memberDeviceRepository
        .createQueryBuilder('memberDevice')
        .select('*')
        .where('memberDevice.memberIdx = :memberIdx', { memberIdx: member.idx })
        .andWhere('memberDevice.action = :action', { action: 1 })
        .getRawMany();
      console.log('\x1b[97m\x1b[41m[CRITICAL] tokenList:\x1b[0m', tokenList);

      if (!tokenList || tokenList.length === 0) {
        console.warn('No device tokens found for member:', member.idx);
        return; // 디바이스 토큰이 없으면 알림 전송하지 않음
      }

      //merchant_id 로 이름 가져오기
      const affiliate = await this.affiliateRepository.findOne({
        where: { merchant_id: data.merchant_id },
      });

      if (tokenList.length == 1) {
        const fcmData = {
          title: '새로운 추천인 적립금 발생',
          body: `${affiliate.name}적립금 발생, 금액: ${data.resultKRW} KRW`,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          room: '/AffiliateScreen',
          roomId: '2',
          token: tokenList[0].device_token, // 디바이스 토큰
        };
        console.log('\x1b[97m\x1b[41m[CRITICAL] fcmData:\x1b[0m', fcmData);
        await this.sendFcmMessage(fcmData);

        // 🔽 pushLog DB 저장
        const pushLog = {
          type: 'fix',
          category: 'inform',
          deviceId: tokenList[0].device_id,
          title: fcmData.title,
          subTitle: fcmData.body,
          templateName: 'affiliate_occurrence',
          isRead: 0,
          roomName: fcmData.room,
          roomIdx: fcmData.roomId,
          memberIdx: member.idx,
          memberId: member.id,
          memberName: member.name,
          created_at: new Date().toISOString(),
        };

        await this.pushLogRepository.save(pushLog);
      } else {
        // 여러 디바이스 토큰이 있는 경우
        for (const token of tokenList) {
          const fcmData = {
            title: '새로운 추천인 적립금 발생',
            body: `${affiliate.name}적립금 발생, 금액: ${data.resultKRW} KRW`,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            room: '/AffiliateScreen',
            roomId: '2',
            token: token.device_token, // 각 디바이스 토큰
          };

          await this.sendFcmMessage(fcmData);

          // 🔽 pushLog DB 저장
          const pushLog = {
            type: 'fix',
            category: 'inform',
            deviceId: token.device_id,
            title: fcmData.title,
            subTitle: fcmData.body,
            templateName: 'affiliate_occurrence',
            isRead: 0,
            roomName: fcmData.room,
            roomIdx: fcmData.roomId,
            memberIdx: member.idx,
            memberId: member.id,
            memberName: member.name,
            created_at: new Date().toISOString(),
          };

          await this.pushLogRepository.save(pushLog);
        }
      }

      // // ApiplexService를 통해 알림 전송\
      // const param = {
      //   돈벌기탭: await getShortLink('AffiliateScreen'),
      // };
      // const talk = await this.apiplexService.sendUserAlimtalk('h94lgjalfjrj', phone, param);
    }
  }
}
