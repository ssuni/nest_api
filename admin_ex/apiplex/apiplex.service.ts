import { HttpException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Admin } from '../../entity/entities/Admin';
import { Partner } from '../../entity/entities/Partner';
import { Member } from '../../entity/entities/Member';
import { Campaign } from '../../entity/entities/Campaign';
import { CampaignItem } from '../../entity/entities/CampaignItem';
import { NotificationTalk } from '../../entity/entities/NotificationTalk';
import { NotificationTalk as WairiNotificationTalk } from '../../entity/secondary_entities/NotificationTalk';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Pagination } from '../paginate';

@Injectable()
export class ApiplexService {
  private readonly API_PLEX_ID: string;
  private readonly API_PLEX_KEY: string;
  private readonly API_OUTGOING_KEY: string;
  private readonly API_PLEX_ID_PIG: string;
  private readonly API_PLEX_KEY_PIG: string;
  private readonly API_OUTGOING_KEY_PIG: string;
  private readonly API_PLEX_URL: string;
  private readonly authorizationHeader: string;
  private readonly authorizationHeader_PIG: string;
  private readonly headers: any;
  private readonly headers_PIG: any;
  private code: {
    C100: string;
    C500_1: string;
    G150: string;
    G160: string;
    G141: string;
    G140: string;
    G110: string;
    G142: string;
    C400_1: string;
    C400_2: string;
    C400_3: string;
    C404_1: string;
  };

  constructor(
    @InjectRepository(NotificationTalk)
    private readonly notificationTalkRepository: Repository<NotificationTalk>,
    @InjectRepository(WairiNotificationTalk, 'secondaryConnection')
    private readonly wairiNotificationRepository: Repository<WairiNotificationTalk>,
  ) {
    this.API_PLEX_URL = 'https://27ep4ci1w0.apigw.ntruss.com/at-standard/v2/send';

    this.API_PLEX_ID = 'wairi2';
    this.API_PLEX_KEY = 'cec2ba1f-4cef-471b-b657-aad53d2a09e5';
    this.API_OUTGOING_KEY = 'bbd6e55481976d70fb0d573d216e93093d276826';
    this.authorizationHeader = this.API_PLEX_ID + ';' + this.API_PLEX_KEY;
    this.headers = {
      Authorization: this.authorizationHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    };

    this.API_PLEX_ID_PIG = 'wairi3';
    this.API_PLEX_KEY_PIG = 'd492b274-5517-4580-88c8-19fb90546200';
    this.API_OUTGOING_KEY_PIG = 'eb44ba58accd7bbf94d27cc7a2af328f922253b4';
    this.authorizationHeader_PIG = this.API_PLEX_ID_PIG + ';' + this.API_PLEX_KEY_PIG;
    this.headers_PIG = {
      Authorization: this.authorizationHeader_PIG,
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
    };

    this.code = {
      C100: '성공',
      C400_1: '잘못된 데이터 타입',
      C400_2: '잘못된 요청 파라미터',
      C400_3: '필수 파라미터 누락',
      C404_1: '데이터를 찾을 수 없음',
      C500_1: '서버 내부 에러',
      G110: 'API UNIQUE ID 예외 (잘못된 URL)',
      G140: '발신번호 예외',
      G141: '수신번호 예외',
      G142: '잘못된 echo_to_webhook	256 byte 초과 또는 type error',
      G150: '여신 부족',
      G160: '1회 발송 최대 수 초과',
    };
  }

  messageTemplates = {
    h94lgjalfjrj: () => this.h94lgjalfjrj(),
    hop239tugoad: () => this.hop239tugoad(),
    TSNQ2d5djV3p: () => this.TSNQ2d5djV3p(),
    toqwe25warGA: () => this.toqwe25warGA(),
    ingf321o2DSF: () => this.ingf321o2DSF(),
    Gkg31gnldafe: () => this.Gkg31gnldafe(),
    det290df35ag: () => this.det290df35ag(),
    th38adfhkgha: () => this.th38adfhkgha(),
    jkl9odhfkafa: () => this.jkl9odhfkafa(), //출금 요청
    zxsca1235gds: () => this.zxsca1235gds(), //추천인 적립금 발생 알림
    glhada122jlf: () => this.glhada122jlf(), //추천인 적립금 발생 알림
    h56189d9g95g: () => this.h56189d9g95g(), //결제 완료 알림
    nl3oy9flgskf: () => this.nl3oy9flgskf(), //결제 완료 알림
    hb2dkgadkhgb: () => this.hb2dkgadkhgb(), //회원가입 알림
  };

  setConfigTemplate(template_code: any, data: any) {
    const msg = this.messageTemplates[template_code](data);
    console.log('\x1b[97m\x1b[41m[CRITICAL] data:\x1b[0m', data);
    return this.textTransform(msg, data);
  }

  private textTransform(msg: string, data: any) {
    // #{key} 형태로 된 문자열을 data[key]로 치환
    const regExp = /#{([^}]+)}/g;
    return msg.replace(regExp, (match, key) => {
      const value = data[key];
      if (typeof value === 'undefined') {
        console.warn(`치환값 없음: [${key}]`);
        return match; // 치환 못하면 원래 텍스트 유지
      }
      return value;
    });
  }

  private textTransform1(msg: string, data: any) {
    // #{key} 형태로 된 문자열을 data[key]로 치환
    const regExp = /#{[a-zA-Z가-힣0-9]*}/g;
    const result = msg.match(regExp);
    if (result) {
      result.forEach((item) => {
        const key = item.replace(/#{|}/g, '');
        console.log('치환 시도:', { item, key, value: data[key] });
        msg = msg.replace(item, data[key]);
      });
    }
    return msg;
  }

  private setConfig(template_code: string, at_template: string, receiver_number: string, data: any) {
    const resultArray = {
      msg_type: 'AT',
      msg_data: [
        {
          msg_key: template_code,
          sender_number: '01027561810',
          receiver_number: receiver_number,
          msg: data,
          sender_key: this.API_OUTGOING_KEY,
          template_code: template_code,
          echo_to_webhook: `${receiver_number}_${Math.floor(Date.now() / 1000)}`,
        },
      ],
    };

    return resultArray;
  }

  private setConfigPig(template_code: string, at_template: string, receiver_number: string, data: any) {
    const resultArray = {
      msg_type: 'AT',
      msg_data: [
        {
          msg_key: template_code,
          sender_number: '01027561810',
          receiver_number: receiver_number,
          msg: data,
          sender_key: this.API_OUTGOING_KEY_PIG,
          template_code: template_code,
          echo_to_webhook: `${receiver_number}_${Math.floor(Date.now() / 1000)}`,
        },
      ],
    };

    return resultArray;
  }

  async sendChannelUpgrade(template_code: string, phone: string, param: any = {}) {
    try {
      const headers = this.headers;
      const setConfigTemplate = this.setConfigTemplate(template_code, param);
      const axioData = this.setConfig(template_code, setConfigTemplate, phone, setConfigTemplate);
      console.log('=>(apiplex.service.ts:115) axioData', axioData);

      // Todo 주석제거
      const result = await axios.post(this.API_PLEX_URL, axioData, { headers });
      console.log('=>(apiplex.service.ts:122) result', result.data.results[0]);
      console.log('=>(apiplex.service.ts:122) result', result.data.results[0].code);
      if (result.data.results[0].code == 'C100') {
        const data = {
          status: this.code[result.data.results.code],
          template_code: template_code,
          echo_to_webhook: axioData.msg_data[0].echo_to_webhook,
          message: setConfigTemplate,
          receiver_number: phone,
          data: JSON.stringify(axioData),
          created_at: new Date(),
        };
        console.log('=>(apiplex.service.ts:144) data', data);
        await this.notificationTalkSave(data);
        return result.data.results[0];
      }
      return result.data.results[0];
      // return;
    } catch (e) {
      console.log('=>(apiplex.service.ts:62) e', e);
    }
  }

  async sendUserAlimtalk(template_code: string, phone: string, param: any = {}) {
    try {
      const headers = this.headers;
      console.log('\x1b[97m\x1b[41m[CRITICAL] param:\x1b[0m', param);
      const setConfigTemplate = this.setConfigTemplate(template_code, param);
      console.log('\x1b[97m\x1b[41m[CRITICAL] setConfigTemplate:\x1b[0m', setConfigTemplate);
      const axioData = this.setConfig(template_code, setConfigTemplate, phone, setConfigTemplate);
      console.log('=>(apiplex.service.ts:115) axioDwaata', axioData);
      const result = await axios.post(this.API_PLEX_URL, axioData, { headers });
      if (result.data.results[0].code == 'C100') {
        const data = {
          status: this.code[result.data.results.code],
          template_code: template_code,
          echo_to_webhook: axioData.msg_data[0].echo_to_webhook,
          message: setConfigTemplate,
          receiver_number: phone,
          data: JSON.stringify(axioData),
          created_at: new Date(),
        };
        console.log('=>(apiplex.service.ts:144) data', data);
        //
        // Todo 주석제거
        // await this.notificationTalkSave(data);
        await this.wairiNotificationSave(data);
        return result.data.results[0];
      }
    } catch (e) {
      console.log('=>(apiplex.service.ts:62) e', e);
    }
  }

  async sendPigUserAlimtalk(template_code: string, phone: string, param: any = {}) {
    try {
      const headers = this.headers_PIG;
      console.log('\x1b[30m\x1b[106m[INFO] headers:\x1b[0m', headers);
      console.log('\x1b[97m\x1b[41m[CRITICAL] param:\x1b[0m', param);
      const setConfigTemplate = this.setConfigTemplate(template_code, param);
      console.log('\x1b[97m\x1b[41m[CRITICAL] setConfigTemplate:\x1b[0m', setConfigTemplate);
      const axioData = this.setConfigPig(template_code, setConfigTemplate, phone, setConfigTemplate);
      console.log('=>(apiplex.service.ts:115) axioData', axioData);
      const result = await axios.post(this.API_PLEX_URL, axioData, { headers });

      console.log('\x1b[30m\x1b[106m[INFO] result.data.results:\x1b[0m', result.data.results);
      console.log('\x1b[97m\x1b[41m[CRITICAL] axioData:\x1b[0m', axioData);
      console.log('\x1b[97m\x1b[41m[CRITICAL] template_code:\x1b[0m', template_code);
      console.log(
        '\x1b[97m\x1b[41m[CRITICAL] axioData.msg_data[0].echo_to_webhook:\x1b[0m',
        axioData.msg_data[0].echo_to_webhook,
      );
      if (result.data.results[0].code == 'C100') {
        const data = {
          status: this.code[result.data.results[0].code],
          template_code: template_code,
          echo_to_webhook: axioData.msg_data[0].echo_to_webhook,
          message: setConfigTemplate,
          receiver_number: phone,
          data: JSON.stringify(axioData),
          created_at: new Date(),
        };
        console.log('=>(apiplex.service.ts:144) data', data);
        //
        // Todo 주석제거
        await this.notificationTalkSave(data);
        // await this.wairiNotificationSave(data);
        return result.data.results[0];
      }
    } catch (e) {
      console.log('=>(apiplex.service.ts:62) e', e);
    }
  }

  async wairiNotificationSave(data: any) {
    try {
      await this.wairiNotificationRepository
        .createQueryBuilder()
        .insert()
        .into(WairiNotificationTalk)
        .values([
          {
            status: data.status,
            templateCode: data.template_code,
            echoToWebhook: data.echo_to_webhook,
            message: data.message,
            receiverNumber: data.receiver_number,
            data: data.data,
            createdAt: data.created_at,
          },
        ])
        .execute();
    } catch (error) {
      throw error;
    }
  }

  async notificationTalkSave(data: any) {
    try {
      await this.notificationTalkRepository
        .createQueryBuilder()
        .insert()
        .into(NotificationTalk, [
          'status',
          'templateCode',
          'echoToWebhook',
          'message',
          'receiverNumber',
          'data',
          'payload', // ← 엔티티 프로퍼티명
          'createdAt',
        ])
        .values([
          {
            status: data.status,
            templateCode: data.template_code,
            echoToWebhook: data.echo_to_webhook,
            message: data.message,
            receiverNumber: data.receiver_number,
            data: data.data,
            createdAt: data.created_at,
          },
        ])
        .execute();
    } catch (error) {
      throw error;
    }
  }
  apiplex_test() {
    return Promise.resolve(undefined);
  }

  private hop239tugoad() {
    //회원가입시 채널등록 알림
    return (
      '안녕하세요 #{이름}님 여행 인플루언서 플랫폼 와이리입니다. \n' +
      '회원가입을 감사드리며 와이리 서비스 원활한 이용을 위하여 [마이 와이리 - 나의 채널관리] 에서 본인의 채널을 등록해주세요.\n' +
      '심사는 영업일 기준 2~3일 소요됩니다.\n' +
      '\n' +
      '감사합니다.'
    );
  }

  private TSNQ2d5djV3p() {
    return '인증번호 : #{인증번호}';
  }

  private toqwe25warGA() {
    return (
      '안녕하세요 #{이름}님.\n' +
      '여행 인플루언서 플랫폼 와이리입니다.\n' +
      '\n' +
      '기존 채널 승인 거절 된 분들의 회원 등급이 업데이트되어 안내드립니다.\n' +
      '\n' +
      '▶기존 나의 등급 : 승인 거절\n' +
      '▶업데이트된 등급 : 실버 인플루언서\n' +
      '\n' +
      '☞실버 인플루언서란? \n' +
      '- 와이리 전체 캠페인 중 일부를 이용할 수 있는 등급입니다. \n' +
      '- 실버 등급은 와이리 앱에서만 서비스 사용이 가능하며 웹에서는 사용이 불가능합니다.\n' +
      '\n' +
      '채널 승인 거절로 그동안 와이리 서비스를 이용하지 못한 회원분들도 이제는 와이리를 이용할 수 있게 되었습니다!\n' +
      '더욱 나은 서비스를 제공할 수 있도록 노력하는 와이리가 되겠습니다.\n' +
      '감사합니다.\n' +
      '\n' +
      '※본 메시지는 이용약관 제 8조 1항의 동의에 따라 회원 등급 전환 안내 메시지입니다.'
    );
  }

  private ingf321o2DSF() {
    return (
      '안녕하세요 #{이름}님.\n' +
      '여행 인플루언서 플랫폼 와이리입니다.\n' +
      '\n' +
      '기존 성장형 인플루언서분들의 회원 등급이 업데이트되어 안내드립니다.\n' +
      '\n' +
      '▶ 기존 나의 등급 : 성장형 인플루언서\n' +
      '▶ 업데이트된 등급 : 실버 인플루언서\n' +
      '\n' +
      '☞ 실버 인플루언서란? \n' +
      '- 와이리 전체 캠페인 중 일부를 이용할 수 있는 등급입니다.\n' +
      '- 실버 등급은 와이리 앱에서만 서비스 사용이 가능하며 웹에서는 사용이 불가능합니다.\n' +
      '\n' +
      '더욱 나은 서비스를 제공할 수 있도록 노력하는 와이리가 되겠습니다.\n' +
      '감사합니다.\n' +
      '\n' +
      '※본 메시지는 이용약관 제 8조 1항의 동의에 따라 회원 등급 전환 안내 메시지입니다.'
    );
  }

  private Gkg31gnldafe() {
    return (
      '안녕하세요 와이리입니다.\n' +
      '\n' +
      '2023년 9월 15일 개인정보 보호법 개정(개정전 제39조의6 삭제)에 따라 회원 휴면 정책이 변경되어 안내드립니다.\n' +
      '변경된 약관은 공지사항에서 확인할 수 있습니다.\n' +
      '\n' +
      '* 변경 내용 : 휴면으로 분류되었던 회원 계정은 7월 24일부터 순차적으로 ‘실버 등급 회원’으로 전환됩니다.\n' +
      '\n' +
      '☞ 실버 인플루언서란? \n' +
      '- 와이리 전체 캠페인 중 일부를 이용할 수 있는 등급입니다.\n' +
      '- 실버 등급은 와이리 앱에서만 서비스 사용이 가능하며 웹에서는 사용이 불가능합니다.\n' +
      '\n' +
      '*변경을 원하지 않고, 회원 탈퇴를 원하시는 분들은 고객센터로 연락 부탁드립니다. 감사합니다.'
    );
  }

  private det290df35ag() {
    return (
      '안녕하세요 #{이름}님.\n' +
      '여행 인플루언서 플랫폼 와이리입니다.\n' +
      '\n' +
      '축하합니다 ! 요청하신 회원님의 #{등록한채널유형}의 등급이 업데이트 되어 안내드립니다.\n' +
      '\n' +
      '▶ 기존 나의 등급 : 실버 인플루언서\n' +
      '▶ 업데이트된 등급 : 골드 인플루언서\n' +
      '\n' +
      '☞골드 인플루언서란 ? 와이리 모든 캠페인을 이용할 수 있는 등급입니다\n' +
      '\n' +
      '더욱 나은 서비스를 제공할 수 있도록 노력하는 와이리가 되겠습니다.\n' +
      '감사합니다.\n' +
      '\n' +
      '※본 메시지는 이용약관 제 8조 1항의 동의에 따라 회원 등급 전환 안내 메시지입니다.'
    );
  }

  private det290dfgal2() {
    return (
      '안녕하세요 #{이름}님.\n' +
      '여행 인플루언서 플랫폼 와이리입니다.\n' +
      '\n' +
      '회원 등급이 업데이트되어 안내드립니다.\n' +
      '\n' +
      '▶ 기존 나의 등급 : 실버 인플루언서\n' +
      '▶ 업데이트된 등급 : 골드 인플루언서\n' +
      '\n' +
      '☞골드 인플루언서란 ? 와이리 모든 캠페인을 이용할 수 있는 등급입니다\n' +
      '\n' +
      '더욱 나은 서비스를 제공할 수 있도록 노력하는 와이리가 되겠습니다.\n' +
      '감사합니다.\n' +
      '\n' +
      '※본 메시지는 이용약관 제 8조 1항의 동의에 따라 회원 등급 전환 안내 메시지입니다.'
    );
  }

  private h94lgjalfjrj() {
    return (
      '[와이리 제휴링크 새로운 수익 발생 안내]\n' +
      '\n' +
      '축하합니다! 회원님이 생성하신 제휴링크로 인해 1건의 예약 및 결제가 완료되었습니다! \n' +
      '얼마가 모였을지 지금 바로 확인하세요💸\n' +
      '\n' +
      '바로가기> #{돈벌기탭}'
    );
  }

  private th38adfhkgha() {
    return (
      '[와이리 제휴링크 새로운 수익 발생 안내]\n' +
      '\n' +
      '축하합니다! 회원님이 생성하신 제휴링크로 인해 1건의 예약 및 결제가 완료되었습니다! \n' +
      '얼마가 모였을지 지금 바로 확인하세요💸\n' +
      '\n' +
      '바로가기>  #{돈벌기 내 절약돼지탭}'
    );
  }

  /**
   * 출금 요청
   * @private
   */
  private jkl9odhfkafa() {
    return '[절약돼지]\n' + '\n' + '#{출금금액} KRW 출금 요청이 정상 접수되었습니다.';
  }

  /**
   * 추천인 적립금 발생 알림
   * @private
   */
  private zxsca1235gds() {
    return (
      '[절약돼지]\n' +
      '\n' +
      '새로운 추천인 적립금 발생!\n' +
      '내 추천인코드로 가입한 사람이 #{제휴처명}을(를) 결제해서 #{적립금} KRW 이 쌓였어요!\n' +
      '\n' +
      '확인하기 ▶ #{초대리워드}'
    );
  }
  private glhada122jlf() {
    return (
      '새로운 추천인 적립금 발생!\n' +
      '내 추천인코드로 가입한 사람이 #{제휴처명}을(를) 결제해서 #{적립금} KRW 이 쌓였어요!\n' +
      '\n' +
      '확인하기 ▶ #{초대리워드}'
    );
  }

  /**
   * 결제 완료 알림
   * @private
   */
  private h56189d9g95g() {
    return '[절약돼지]\n' + '\n' + '#{제휴처명} 결제가 완료되었습니다. 예상 적립금 : #{적립금} KRW';
  }
  private nl3oy9flgskf() {
    return '#{제휴처명} 결제가 완료되었습니다. 예상 적립금 : #{적립금} KRW';
  }

  /**
   * 회원가입 알림
   * @private
   */
  private hb2dkgadkhgb() {
    return (
      '[절약돼지]\n' +
      '\n' +
      '가입을 환영합니다! \n' +
      '지금부터 똑똑한 소비를 시작하며 지출을 수입으로 바꿔보세요! 🐽\n' +
      '\n' +
      '이용 방법 바로 보기 ▶ #{절약돼지이용가이드}'
    );
  }

  async findApiplexList(page, limit, message, phone, code) {
    try {
      const queryBuilder = this.notificationTalkRepository.createQueryBuilder('notificationTalk');
      queryBuilder
        .select([
          'notificationTalk.idx AS idx',
          'notificationTalk.status AS status',
          'notificationTalk.templateCode AS templateCode',
          'notificationTalk.echoToWebhook AS echoToWebhook',
          'notificationTalk.message AS message',
          'notificationTalk.receiverNumber AS receiverNumber',
          'notificationTalk.data AS data',
          'notificationTalk.createdAt AS createdAt',
          'notificationTalkCallBack.done_date AS doneDate',
        ])
        .leftJoin(
          'notificationTalkCallBack',
          'notificationTalkCallBack',
          'notificationTalkCallBack.echo_to_webhook = notificationTalk.echo_to_webhook and notificationTalkCallBack.template_code = notificationTalk.templateCode',
        )
        .orderBy('notificationTalk.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (message) {
        queryBuilder.andWhere('notificationTalk.message LIKE :message', { message: `%${message}%` });
      }
      if (phone) {
        queryBuilder.andWhere('notificationTalk.receiverNumber LIKE :phone', { phone: `%${phone}%` });
      }
      if (code) {
        queryBuilder.andWhere('notificationTalk.templateCode LIKE :code', { code: `%${code}%` });
      }
      queryBuilder.orderBy('notificationTalk.idx', 'DESC');

      // const [data, total] = await queryBuilder.getManyAndCount();
      const [data, total] = await Promise.all([
        queryBuilder.getRawMany(), // ✅ raw 데이터 (doneDate 포함)
        queryBuilder.getCount(), // ✅ 전체 개수
      ]);
      console.log('\x1b[97m\x1b[41m[CRITICAL] total:\x1b[0m', total);
      const totalPage = Math.ceil(total / limit);
      const currentPage = page;
      console.log('\x1b[97m\x1b[41m[CRITICAL] totalPage:\x1b[0m', totalPage);
      return new Pagination(
        {
          data,
          total,
          totalPage,
          currentPage,
        },
        Number(limit),
      );
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }
}
