import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Member } from '../../entity/entities/Member';
import { MemberChannel } from '../../entity/entities/MemberChannel';
import { Partner } from '../../entity/entities/Partner';
import { Campaign } from '../../entity/entities/Campaign';
import { CampaignSubmit } from '../../entity/entities/CampaignSubmit';
import { ShortLink } from '../../entity/entities/ShortLink';
import { AES_DECRYPT, bufferToString } from '../util/util';
import { ApiplexService } from '../apiplex/apiplex.service';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MemberBlock } from '../../entity/entities/MemberBlock';
import { TripMemberCash } from '../../entity/entities/TripMemberCash';
import { Member as WairiMember } from '../../entity/secondary_entities/Member';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(WairiMember, 'secondaryConnection')
    private readonly wairiMemberRepository: Repository<WairiMember>,
    @InjectRepository(MemberChannel)
    private readonly memberChannelRepository: Repository<MemberChannel>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignSubmit)
    private readonly campaignSubmitRepository: Repository<CampaignSubmit>,
    @InjectRepository(ShortLink)
    private readonly shortLinkRepository: Repository<ShortLink>,
    @InjectRepository(MemberBlock)
    private readonly memberBlockRepository: Repository<MemberBlock>,
    @InjectRepository(TripMemberCash)
    private readonly tripMemberCashRepository: Repository<TripMemberCash>,
    private dataSource: DataSource,
    private apiplexService: ApiplexService,
  ) {}

  async main(user: any) {
    try {
      const memberPannel = await this.memberChannelRepository.find({ where: { level: 0 } });
      console.log('=>(admin_dashboard.service.ts:29) memberPannel', memberPannel);
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async scheduleChange(body: any) {
    console.log('=>(admin_dashboard.service.ts:36) body', body);
    try {
      const sid = body.sid;
      //startDate,endDate unixtime으로 변환
      let startUnix = Math.floor(new Date(body.startDate).getTime() / 1000);
      let endUnix = Math.floor(new Date(body.endDate).getTime() / 1000);
      //startUnix endUnix 둘다 -9 시간 해줘야함
      startUnix = startUnix - 32400;
      endUnix = endUnix - 32400;

      const campaignSubmit = await this.campaignSubmitRepository.findOne({ where: { sid: sid } });
      console.log('=>(admin_dashboard.service.ts:43) campaignSubmit', campaignSubmit);
      bufferToString(campaignSubmit);

      if (campaignSubmit) {
        //update campaignSubmit.idx
        const result = await this.campaignSubmitRepository.update(campaignSubmit.idx, {
          startDate: startUnix,
          endDate: endUnix,
        });

        if (result.affected > 0) {
          return { success: true };
        } else {
          return { success: false };
        }
      }
    } catch (e) {
      console.log('=>(admin_dashboard.service.ts:60) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async policyChange(body: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      //campaign caution update
      const caution = body.caution;
      const campaignCautionUpdate = await queryRunner.manager.query(
        `UPDATE campaign SET caution = '${caution}' WHERE 1=1`,
      );
      //campaignItem caution update
      const campaignItemCautionUpdate = await queryRunner.manager.query(
        `UPDATE campaignItem SET infoRefund1 = '${caution}' WHERE 1=1`,
      );
      await queryRunner.commitTransaction();
      await queryRunner.release();
      return { success: true };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(e.message, e.status);
    } finally {
      await queryRunner.release();
    }
  }

  async growthSilver(body: any) {
    const query = this.memberChannelRepository.createQueryBuilder('memberChannel');
    query.leftJoin('memberChannel.member', 'member');
    query.select('memberChannel.idx');
    query.addSelect('member.idx as memberIdx');
    query.addSelect(`(${AES_DECRYPT('member.phone')})`, 'phone');
    query.addSelect(`(${AES_DECRYPT('member.name')})`, 'name');
    query.where('memberChannel.level = 2');
    query.andWhere('member.status != -9');
    //member.phone is not null
    query.andWhere(`(${AES_DECRYPT('member.phone')}) is not null`);

    //memberIdx group by
    query.groupBy('member.idx');
    const memberChannel = await query.getRawMany();
    bufferToString(memberChannel);

    const memberChannelCount = memberChannel.length;
    console.log('=>(admin_dashboard.service.ts:115) memberChannelCount', memberChannelCount);

    for (let i = 0; i < memberChannelCount; i++) {
      const param = {
        이름: memberChannel[i].name,
      };
      const phone = memberChannel[i].phone;
      // console.log('=>(admin_dashboard.service.ts:127) memberChannel[i]', memberChannel[i]);
      // console.log('=>(admin_dashboard.service.ts:117) phone', phone);
      // console.log('=>(admin_dashboard.service.ts:121) param', param);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const talk = await this.apiplexService.sendUserAlimtalk('ingf321o2DSF', phone, param);
    }
  }

  async refuseSilver(body: any) {
    const query = this.memberChannelRepository.createQueryBuilder('memberChannel');
    query.leftJoin('memberChannel.member', 'member');
    query.select('memberChannel.idx');
    query.addSelect('member.idx as memberIdx');
    query.addSelect(`(${AES_DECRYPT('member.phone')})`, 'phone');
    query.addSelect(`(${AES_DECRYPT('member.name')})`, 'name');
    query.where('memberChannel.level = -1');
    query.andWhere('member.status != -9');
    //member.phone is not null
    query.andWhere(`(${AES_DECRYPT('member.phone')}) is not null`);

    // query.offset(6137);
    // query.limit(2000);
    //memberIdx group by
    query.groupBy('member.idx');
    const memberChannel = await query.getRawMany();
    bufferToString(memberChannel);

    const memberChannelCount = memberChannel.length;
    console.log('=>(admin_dashboard.service.ts:115) memberChannelCount', memberChannelCount);

    for (let i = 0; i < memberChannelCount; i++) {
      const param = {
        이름: memberChannel[i].name,
      };
      const phone = memberChannel[i].phone;
      // console.log('=>(admin_dashboard.service.ts:127) memberChannel[i]', memberChannel[i]);
      // console.log('=>(admin_dashboard.service.ts:117) phone', phone);
      // console.log('=>(admin_dashboard.service.ts:121) param', param);
      await new Promise((resolve) => setTimeout(resolve, 700));
      const talk = await this.apiplexService.sendUserAlimtalk('toqwe25warGA', phone, param);
    }
  }

  async dormancyUser(body) {
    const query = this.memberRepository.createQueryBuilder('member');
    query.leftJoin('memberChannel', 'memberChannel', 'member.idx = memberChannel.memberIdx');
    query.select('memberChannel.idx');
    query.addSelect('member.idx as memberIdx');
    query.addSelect(`(${AES_DECRYPT('member.phone')})`, 'phone');
    query.addSelect(`(${AES_DECRYPT('member.name')})`, 'name');
    query.where('member.status = 9');
    query.andWhere(`(${AES_DECRYPT('member.phone')}) is not null`);

    // query.offset(0);
    // query.limit(500);
    //memberIdx group by
    query.groupBy('member.idx');
    const memberChannel = await query.getRawMany();
    bufferToString(memberChannel);

    const memberChannelCount = memberChannel.length;

    for (let i = 0; i < memberChannelCount; i++) {
      const param = {
        이름: memberChannel[i].name,
      };
      const phone = memberChannel[i].phone;
      console.log('=>(admin_dashboard.service.ts:173) memberChannel[i]', memberChannel[i]);
      // console.log('=>(admin_dashboard.service.ts:174) phone', phone);
      // console.log('=>(admin_dashboard.service.ts:175) param', param);

      // const talk = await this.apiplexService.sendUserAlimtalk('toqwe25warGA', phone, param);
    }

    console.log('=>(admin_dashboard.service.ts:161) memberChannelCount', memberChannelCount);
  }

  async dormantStateChange(body: any) {
    try {
      const query = await this.memberRepository.createQueryBuilder('member');
      query.select('member.idx');
      query.addSelect(`(${AES_DECRYPT('member.phone')})`, 'phone');
      query.addSelect(`(${AES_DECRYPT('member.name')})`, 'name');
      query.where('member.status = 9');
      query.andWhere('member.type= 1');
      query.andWhere(`(${AES_DECRYPT('member.phone')}) is not null`);
      const member = await query.getRawMany();
      const count = member.length;
      bufferToString(member);
      console.log('=>(admin_dashboard.service.ts:174) member', member);
      console.log('=>(admin_dashboard.service.ts:173) count', count);

      for (let i = 0; i < count; i++) {
        const phone = member[i].phone;
        //delay 2s
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // const talk = await this.apiplexService.sendUserAlimtalk('Gkg31gnldafe', phone);
      }
      return member;
    } catch (e) {
      console.log('=>(admin_dashboard.service.ts:183) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async channelUpgrade(data: any) {
    try {
      console.log('=>(admin_dashboard.service.ts:229) data', data);
      for (let i = 0; i < data.length; i++) {
        const link = data[i];
        const query = this.memberChannelRepository.createQueryBuilder('memberChannel');
        query.leftJoin('memberChannel.member', 'member');
        query.select('memberChannel.idx as memberChannelIdx');
        query.addSelect('member.idx as memberIdx');
        query.addSelect(
          'CASE WHEN memberChannel.type = 1 THEN "블로그" WHEN memberChannel.type = 2 THEN "유튜브" WHEN memberChannel.type = 3 THEN "인스타그램" WHEN memberChannel.type = 4 THEN "틱톡" WHEN memberChannel.type = 5 THEN "티스토리" ELSE "기타" END',
          'type',
        );
        query.addSelect(`(${AES_DECRYPT('member.phone')})`, 'phone');
        query.addSelect(`(${AES_DECRYPT('member.name')})`, 'name');
        query.where('memberChannel.link = :link', { link });
        query.andWhere('memberChannel.level = 2');
        query.andWhere('member.status != -9');

        const result = await query.getRawOne();
        bufferToString(result);
        console.log('=>(admin_dashboard.service.ts:245) result', result);

        if (result) {
          const param = {
            이름: result.name,
            등록한채널유형: result.type,
          };

          if (result.phone != null) {
            const phone = result.phone;
            //delay 2s
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const updateChannel = await this.memberChannelRepository
              .createQueryBuilder()
              .update(MemberChannel)
              .set({ level: 1 })
              .where('idx = :idx', { idx: result.memberChannelIdx })
              .execute();

            const talk = await this.apiplexService.sendChannelUpgrade('det290df35ag', phone, param);
          }
        }
      }
    } catch (e) {
      console.log('=>(admin_dashboard.service.ts:183) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async tripLink(body: any) {
    try {
      const submitIdx = body.submitIdx;

      const submit = await this.campaignSubmitRepository
        .createQueryBuilder('campaignSubmit')
        .select('campaignIdx,memberIdx')
        .where('campaignSubmit.idx = :idx', { idx: submitIdx })
        .getRawOne();
      console.log('=>(admin_dashboard.service.ts:290) submit', submit);

      const getTripLink = await this.campaignRepository
        .createQueryBuilder('campaign')
        .select('tripLink,name')
        .where('campaign.idx = :idx', { idx: submit.campaignIdx })
        .getRawOne();
      bufferToString(getTripLink);

      console.log('=>(admin_dashboard.service.ts:291) getTripLink', getTripLink);
      const member = await this.memberRepository
        .createQueryBuilder('member')
        .select('*')
        .where('member.idx = :idx', { idx: submit.memberIdx })
        .getRawOne();
      bufferToString(member);

      //트립 숏링크 생성
      const shortLinkCode = await this.createShortLink();
      // 추가 파라미터 설정
      const addParam = `allianceId=3419652&sid=16519959&ouid=${member.id}`;

      // 숏링크 데이터 설정
      const shortLinkData = {
        memberIdx: member.idx,
        submitIdx: submitIdx,
        orderName: getTripLink.name,
        code: shortLinkCode,
        returnUrl: `${getTripLink.tripLink}&${addParam}`,
        count: 0,
        createdAt: new Date(),
      };

      // 데이터 삽입
      if (getTripLink.tripLink) {
        const shortLink = this.shortLinkRepository.create(shortLinkData);
        await this.shortLinkRepository.save(shortLink);
        return shortLink;
      } else {
        return { success: false, message: '트립 링크가 없습니다.' };
      }
    } catch (e) {
      console.log('=>(admin_dashboard.service.ts:183) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async createShortLink(): Promise<string> {
    // 20자리 난수 생성
    const randomString = this.generateRandomString(20);

    // shortLink 중복체크
    const isDuplicate = await this.getShortLink(randomString);
    if (isDuplicate) {
      return this.createShortLink();
    }

    return randomString;
  }

  private generateRandomString(length: number): string {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
  }

  private async getShortLink(randomString: string) {
    const shortLink = await this.shortLinkRepository.findOne({ where: { code: randomString } });
    return shortLink;
  }

  async shortLink(body: any) {
    try {
      const memberId = body.memberId;
      const tripUrl = body.tripUrl;

      const title = await this.crawl(tripUrl);
      const member = await this.memberRepository.findOne({ where: { id: memberId } });

      //트립 숏링크 생성
      const shortLinkCode = await this.createShortLink();
      // 추가 파라미터 설정
      const addParam = `allianceId=3419652&sid=16519959&ouid=${memberId}`;

      // 숏링크 데이터 설정
      const shortLinkData = {
        memberIdx: member.idx,
        // submitIdx: submitIdx,
        orderName: title,
        code: shortLinkCode,
        returnUrl: `${tripUrl}&${addParam}`,
        count: 0,
        createdAt: new Date(),
      };
      const shortLink = await this.shortLinkRepository.save(shortLinkData);
      console.log('=>(admin_dashboard.service.ts:391) shortLink', shortLink);
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async crawl(url: string): Promise<any> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      //<title> 태그의 텍스트 추출
      const title = $('title').text().trim();

      // 'headInit_headInit-title' 클래스를 가진 요소 찾기
      const titleContainer = $('[class*="headInit_headInit-title"]');

      // 해당 요소 내부의 <h1> 태그 찾기
      const titleElement = titleContainer.find('h1');

      // <h1> 태그의 텍스트 추출
      const titleText = titleElement.text().trim();

      //title이 없을경우 titleText를 titleText없을경우 'No title found'를 반환
      return title || titleText || 'No title found';
    } catch (error) {
      console.error('Error crawling:', error);
      throw error;
    }
  }

  async delIdentityVerification(body: any) {
    try {
      //member id 일치 하는 계정 phone, ci ,di 삭제
      const memberId = body.memberId;
      const member = await this.memberRepository.findOne({ where: { id: memberId } });
      if (member) {
        await this.memberRepository.update(member.idx, {
          phone: null,
          ci: null,
          di: null,
        });
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async blockUser(body: any) {
    try {
      const memberId = body.id;
      const date = body.date;

      const member = await this.memberRepository.findOne({ where: { id: memberId } });
      console.log('=>(admin_dashboard.service.ts:450) member', member);
      if (!member) {
        return { success: false, message: 'Invalid member' };
      }

      console.log('=>(admin_dashboard.service.ts:449) memberId', memberId);
      console.log('=>(admin_dashboard.service.ts:449) memberId', member.idx);
      console.log('=>(admin_dashboard.service.ts:451) date', date);

      const memberBlock = await this.memberBlockRepository.findOne({ where: { memberIdx: member.idx } });
      if (memberBlock) {
        //update block_date
        await this.memberBlockRepository.update(memberBlock.idx, { block_date: date });
      } else {
        //create block_date
        const block = this.memberBlockRepository.create({
          id: memberId,
          memberIdx: member.idx,
          block_date: date,
        });
        await this.memberBlockRepository.save(block);
      }

      return { success: true };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async merchantProfitAll1(body: any) {
    try {
      const startDate = body.startDate || '2025-07-01';

      // 1) 모든 머천트와 매출(없으면 0) Left Join으로 표현
      const sql = `
        SELECT
          a.merchant_id,
          a.name AS merchant_name,
          a.linkprice,
          a.ordering,
          ym.order_ym,
          COALESCE(SUM(tmc.deposit), 0) AS total_deposit,
          COALESCE(SUM(
                     CASE
                       WHEN tmc.influence_deposit > 0 THEN tmc.wairi_deposit - tmc.influence_deposit
                       ELSE tmc.wairi_deposit
                       END
                   ), 0) AS total_wairi_deposit,
          COALESCE(SUM(tmc.influence_deposit), 0) AS total_influence_deposit
        FROM affiliate a
               CROSS JOIN (
          SELECT DISTINCT DATE_FORMAT(orderDate, '%Y-%m') AS order_ym
          FROM tripMemberCash
          WHERE orderDate IS NOT NULL AND orderDate >= ?
        ) ym
               LEFT JOIN tripMemberCash tmc
                         ON a.merchant_id = tmc.division
                           AND DATE_FORMAT(tmc.orderDate, '%Y-%m') = ym.order_ym
                           AND tmc.orderDate IS NOT NULL
                           AND tmc.orderDate >= ?
        GROUP BY a.merchant_id, a.name, a.linkprice, a.ordering, ym.order_ym
        ORDER BY a.ordering, a.merchant_id, ym.order_ym
      `;

      // 2) 쿼리 실행
      const rawRows = await this.tripMemberCashRepository.query(sql, [startDate, startDate]);

      // 3) JS에서 머천트별, 월별 누적 계산
      // merchant_id + 월별로 정렬 필요
      const grouped = {};
      for (const row of rawRows) {
        const key = row.merchant_id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      // 누적 집계 처리
      const result: any[] = [];
      for (const merchant_id in grouped) {
        let cumulative_deposit = 0;
        let cumulative_wairi_deposit = 0;
        let cumulative_influence_deposit = 0;
        // 월별 정렬
        grouped[merchant_id].sort((a, b) => a.order_ym.localeCompare(b.order_ym));
        for (const row of grouped[merchant_id]) {
          cumulative_deposit += Number(row.total_deposit);
          cumulative_wairi_deposit += Number(row.total_wairi_deposit);
          cumulative_influence_deposit += Number(row.total_influence_deposit);
          result.push({
            merchant_id: row.merchant_id,
            merchant_name: row.merchant_name,
            linkprice: row.linkprice,
            order_ym: row.order_ym,
            total_deposit: Number(row.total_deposit),
            total_wairi_deposit: Number(row.total_wairi_deposit),
            total_influence_deposit: Number(row.total_influence_deposit),
            cumulative_deposit,
            cumulative_wairi_deposit,
            cumulative_influence_deposit,
          });
        }
      }

      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status || 500);
    }
  }

  async merchantProfitAll(body: any) {
    try {
      const startDate = body.startDate || '2025-07-01';

      // 1) 모든 머천트와 매출(없으면 0) Left Join으로 표현
      const sql = `
        SELECT
          a.merchant_id,
          a.name AS merchant_name,
          a.linkprice,
          a.ordering,
          ym.order_ym,

          -- 전체
          COALESCE(SUM(tmc.deposit), 0) AS total_deposit,
          COALESCE(SUM(
                     CASE WHEN tmc.influence_deposit > 0 THEN tmc.wairi_deposit - tmc.influence_deposit
                          ELSE tmc.wairi_deposit END
                   ), 0) AS total_wairi_deposit,
          COALESCE(SUM(tmc.influence_deposit), 0) AS total_influence_deposit,

          -- 취소 아님(정상)
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NULL THEN tmc.deposit ELSE 0 END), 0) AS normal_deposit,
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NULL AND tmc.influence_deposit > 0 THEN tmc.wairi_deposit - tmc.influence_deposit
                            WHEN tmc.cancelDate IS NULL THEN tmc.wairi_deposit
                            ELSE 0 END), 0) AS normal_wairi_deposit,
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NULL THEN tmc.influence_deposit ELSE 0 END), 0) AS normal_influence_deposit,
          COUNT(CASE WHEN tmc.cancelDate IS NULL AND tmc.deposit IS NOT NULL THEN 1 END) AS normal_count,

          -- 취소(취소건)
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NOT NULL THEN tmc.deposit ELSE 0 END), 0) AS cancel_deposit,
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NOT NULL AND tmc.influence_deposit > 0 THEN tmc.wairi_deposit - tmc.influence_deposit
                            WHEN tmc.cancelDate IS NOT NULL THEN tmc.wairi_deposit
                            ELSE 0 END), 0) AS cancel_wairi_deposit,
          COALESCE(SUM(CASE WHEN tmc.cancelDate IS NOT NULL THEN tmc.influence_deposit ELSE 0 END), 0) AS cancel_influence_deposit,
          COUNT(CASE WHEN tmc.cancelDate IS NOT NULL AND tmc.deposit IS NOT NULL THEN 1 END) AS cancel_count

        FROM affiliate a
               CROSS JOIN (
          SELECT DISTINCT DATE_FORMAT(orderDate, '%Y-%m') AS order_ym
          FROM tripMemberCash
          WHERE orderDate IS NOT NULL AND orderDate >= ?
        ) ym
               LEFT JOIN tripMemberCash tmc
                         ON a.merchant_id = tmc.division
                           AND DATE_FORMAT(tmc.orderDate, '%Y-%m') = ym.order_ym
                           AND tmc.orderDate IS NOT NULL
                           AND tmc.orderDate >= ?
        GROUP BY a.merchant_id, a.name, a.linkprice, a.ordering, ym.order_ym
        ORDER BY a.ordering, a.merchant_id, ym.order_ym
      `;

      // 2) 쿼리 실행
      const rawRows = await this.tripMemberCashRepository.query(sql, [startDate, startDate]);

      // 3) JS에서 머천트별, 월별 누적 계산
      // merchant_id + 월별로 정렬 필요
      const grouped = {};
      for (const row of rawRows) {
        const key = row.merchant_id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      // 누적 집계 처리
      const result: any[] = [];
      for (const merchant_id in grouped) {
        let cumulative_deposit = 0;
        let cumulative_wairi_deposit = 0;
        let cumulative_influence_deposit = 0;

        let cumulative_normal_deposit = 0;
        let cumulative_normal_wairi_deposit = 0;
        let cumulative_normal_influence_deposit = 0;
        let cumulative_normal_count = 0;

        let cumulative_cancel_deposit = 0;
        let cumulative_cancel_wairi_deposit = 0;
        let cumulative_cancel_influence_deposit = 0;
        let cumulative_cancel_count = 0;
        // 월별 정렬
        grouped[merchant_id].sort((a, b) => a.order_ym.localeCompare(b.order_ym));
        for (const row of grouped[merchant_id]) {
          cumulative_deposit += Number(row.total_deposit);
          cumulative_wairi_deposit += Number(row.total_wairi_deposit);
          cumulative_influence_deposit += Number(row.total_influence_deposit);

          cumulative_normal_deposit += Number(row.normal_deposit);
          cumulative_normal_wairi_deposit += Number(row.normal_wairi_deposit);
          cumulative_normal_influence_deposit += Number(row.normal_influence_deposit);
          cumulative_normal_count += Number(row.normal_count);

          cumulative_cancel_deposit += Number(row.cancel_deposit);
          cumulative_cancel_wairi_deposit += Number(row.cancel_wairi_deposit);
          cumulative_cancel_influence_deposit += Number(row.cancel_influence_deposit);
          cumulative_cancel_count += Number(row.cancel_count);

          result.push({
            merchant_id: row.merchant_id,
            merchant_name: row.merchant_name,
            linkprice: row.linkprice,
            order_ym: row.order_ym,
            total_deposit: Number(row.total_deposit),
            total_wairi_deposit: Number(row.total_wairi_deposit),
            total_influence_deposit: Number(row.total_influence_deposit),
            cumulative_deposit,
            cumulative_wairi_deposit,
            cumulative_influence_deposit,

            // 정상 건
            normal_deposit: Number(row.normal_deposit),
            normal_wairi_deposit: Number(row.normal_wairi_deposit),
            normal_influence_deposit: Number(row.normal_influence_deposit),
            normal_count: Number(row.normal_count),
            cumulative_normal_deposit,
            cumulative_normal_wairi_deposit,
            cumulative_normal_influence_deposit,
            cumulative_normal_count,

            // 취소 건
            cancel_deposit: Number(row.cancel_deposit),
            cancel_wairi_deposit: Number(row.cancel_wairi_deposit),
            cancel_influence_deposit: Number(row.cancel_influence_deposit),
            cancel_count: Number(row.cancel_count),
            // cumulative_cancel_deposit,
            // cumulative_cancel_wairi_deposit,
            // cumulative_cancel_influence_deposit,
            cumulative_cancel_count,
          });
        }
      }

      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status || 500);
    }
  }

  /**
   * 일자별 , 월별 회원 가입 현황
   * @param body
   */
  async memberJoinDay(body: any) {
    try {
      //body startDate 가 없다면 현재기준 달의 첫날로 설정
      const startDate = body.startDate ? body.startDate : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      //body endDate 가 없다면 현재기준 달의 마지막날로 설정
      const endDate = body.endDate ? body.endDate : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const query = this.memberRepository.createQueryBuilder('member');
      query.select("DATE_FORMAT(member.created_at, '%Y-%m-%d')", 'date');
      query.addSelect('COUNT(*)', 'count');
      query.where('member.created_at BETWEEN :startDate AND :endDate', { startDate, endDate });
      query.groupBy('date');
      query.orderBy('date', 'DESC');

      const result = await query.getRawMany();
      // join_count를 숫자로 변환
      const parsedResult = result.map((row) => ({
        ...row,
        count: Number(row.count),
      }));
      bufferToString(parsedResult);
      return parsedResult;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  /**
   * 회원 가입 현황 월별
   * @param body
   */
  async memberJoinMonth(body: any) {
    try {
      //body year 가 없다면 현재 년도로 설정
      const year = body.year ? body.year : new Date().getFullYear();
      const query = this.memberRepository.createQueryBuilder('member');
      query.select("DATE_FORMAT(member.created_at, '%Y-%m')", 'join_month');
      query.addSelect('COUNT(*)', 'join_count');
      query.where('YEAR(member.created_at) = :year', { year });
      query.groupBy('join_month');
      query.orderBy('join_month', 'ASC');
      const result = await query.getRawMany();
      bufferToString(result);
      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async memberJoinMonthAll(body: any) {
    try {
      const year = body.year ? Number(body.year) : new Date().getFullYear();

      // 월별 가입자수만 추출 (없는 월은 결과에 없음)
      const qb = this.memberRepository
        .createQueryBuilder('member')
        .select('LPAD(MONTH(member.created_at), 2, 0)', 'month')
        .addSelect('COUNT(*)', 'count')
        .where('YEAR(member.created_at) = :year', { year })
        .groupBy('month')
        .orderBy('month', 'ASC');
      const raw = await qb.getRawMany();

      // 1~12월 결과 생성
      const result: { month: string; count: number }[] = [];
      for (let m = 1; m <= 12; m++) {
        const monthStr = m.toString().padStart(2, '0');
        const found = raw.find((r) => r.month === monthStr);
        result.push({
          month: monthStr,
          count: found ? Number(found.count) : 0,
        });
      }

      bufferToString(result);
      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async memberJoinMonthAll1(body: any) {
    try {
      const year = body.year ? Number(body.year) : new Date().getFullYear();

      const sql = `
      SELECT
        LPAD(m.month, 2, '0') AS month,
        COALESCE(COUNT(member.id), 0) AS join_count
      FROM (
        SELECT 1 AS month UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
        UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
      ) m
      LEFT JOIN member ON MONTH(member.created_at) = m.month AND YEAR(member.created_at) = ?
      GROUP BY m.month
      ORDER BY m.month
    `;
      const result = await this.memberRepository.query(sql, [year]);
      bufferToString(result);
      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  /**
   * 절약돼지 추천인 코드로 가입한 회원 주단위 상위 5명
   * @param body { year?: number }
   */
  async memberJoinPigCode(body: any) {
    try {
      // 파라미터로 연도 등 필요시 아래 부분에서 가공하여 사용 가능
      // const year = body.year ? Number(body.year) : new Date().getFullYear();

      const sql = `
      SELECT
        t.year,
        t.week,
        t.code AS recommended_code,
        t.name,
        t.id,
        t.recommend_count,
        DATE_FORMAT(
          DATE_SUB(DATE(t.min_created_at), INTERVAL (DAYOFWEEK(DATE(t.min_created_at)) + 5) % 7 DAY),
          '%Y-%m-%d 00:00:00'
        ) AS week_start_date,
        DATE_FORMAT(
          DATE_ADD(
            DATE_SUB(DATE(t.min_created_at), INTERVAL (DAYOFWEEK(DATE(t.min_created_at)) + 5) % 7 DAY),
            INTERVAL 6 DAY
          ),
          '%Y-%m-%d 23:59:59'
        ) AS week_end_date
      FROM (
        SELECT
          m.code,
          m.name,
          m.id,
          YEAR(r.created_at) AS year,
          WEEK(r.created_at, 1) AS week,
          COUNT(*) AS recommend_count,
          MIN(r.created_at) AS min_created_at,
          ROW_NUMBER() OVER (
            PARTITION BY YEAR(r.created_at), WEEK(r.created_at, 1)
            ORDER BY COUNT(*) DESC
          ) AS rn
        FROM member m
        JOIN member r
          ON r.refererRoot = 4
         AND r.refererRootInput = m.code
         AND r.created_at IS NOT NULL
        WHERE m.code IS NOT NULL
          AND r.created_at IS NOT NULL
        GROUP BY m.code, m.name, m.id, YEAR(r.created_at), WEEK(r.created_at, 1)
      ) t
      WHERE t.rn <= 5
      ORDER BY t.year DESC, t.week DESC, t.recommend_count DESC, t.code
    `;

      // TypeORM의 query()로 raw SQL 실행
      const result = await this.memberRepository.query(sql);

      // recommend_count를 number로 변환
      const parsedResult = result.map((row) => ({
        ...row,
        recommend_count: Number(row.recommend_count),
      }));

      return parsedResult;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async memberJoinWiriCode(): Promise<any[]> {
    try {
      // 1. 1차 DB (member)에서 recommended_code, created_at 조회
      const memberSql = `
      SELECT recommended_code, created_at 
      FROM member
      WHERE recommended_code IS NOT NULL AND created_at IS NOT NULL
    `;
      const memberRecommends = await this.memberRepository.query(memberSql);

      // 2. 2차 DB (wairiMember)에서 code, name, id 조회
      const wairiMembers = await this.wairiMemberRepository
        .createQueryBuilder('wairiMember')
        .select('*')
        .addSelect(`(${AES_DECRYPT('wairiMember.name')})`, 'name')
        .getRawMany();

      bufferToString(wairiMembers);
      const wairiMemberMap = {};
      for (const wm of wairiMembers) {
        if (wm.code) wairiMemberMap[wm.code] = { name: wm.name, id: wm.id };
      }

      // 3. 주차 계산 및 집계 (표준 JS로)
      function getWeekInfo(d: Date) {
        // ISO-8601 기준과 거의 동일하게 월요일 시작 (MySQL WEEK(date,1))
        // https://dev.mysql.com/doc/refman/8.0/en/date-and-time-functions.html#function_week
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        // 목요일이 속한 해가 연도로 사용됨
        const dayNum = date.getUTCDay() || 7; // Sunday=0 -> 7
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.floor(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1;
        // 주 시작일: 월요일, 주 끝일: 일요일
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 월요일
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          year: date.getUTCFullYear(),
          week: weekNo,
          week_start_date: monday.toISOString().slice(0, 10) + ' 00:00:00',
          week_end_date: sunday.toISOString().slice(0, 10) + ' 23:59:59',
        };
      }

      // 4. 추천코드별, 주별 집계
      type AggObj = {
        code: string;
        year: number;
        week: number;
        name: string;
        id: string;
        recommend_count: number;
        week_start_date: string;
        week_end_date: string;
      };
      const agg: Record<string, AggObj> = {
        /* ... */
      };
      for (const row of memberRecommends) {
        const code = row.recommended_code;
        if (!code || !wairiMemberMap[code]) continue;
        const d = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        const info = getWeekInfo(d);
        const key = `${info.year}-${info.week}-${code}`;
        if (!agg[key]) {
          agg[key] = {
            code,
            year: info.year,
            week: info.week,
            name: wairiMemberMap[code].name,
            id: wairiMemberMap[code].id,
            recommend_count: 1,
            week_start_date: info.week_start_date,
            week_end_date: info.week_end_date,
          };
        } else {
          agg[key].recommend_count++;
        }
      }

      // 5. 주별 TOP 5 선정
      const weekGroups: Record<string, AggObj[]> = {};
      for (const obj of Object.values(agg) as AggObj[]) {
        const weekKey = `${obj.year}-${obj.week}`;
        if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
        weekGroups[weekKey].push(obj);
      }
      const result: AggObj[] = [];
      for (const arr of Object.values(weekGroups) as AggObj[][]) {
        arr.sort((a, b) => b.recommend_count - a.recommend_count || a.code.localeCompare(b.code));
        result.push(...arr.slice(0, 5));
      }
      // 전체 정렬
      result.sort(
        (a, b) =>
          b.year - a.year || b.week - a.week || b.recommend_count - a.recommend_count || a.code.localeCompare(b.code),
      );
      return result;
    } catch (e) {
      throw new HttpException(e.message, e.status || 500);
    }
  }
}
