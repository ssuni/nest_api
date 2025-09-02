import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Member } from '../../entity/entities/Member';
import { Trip } from '../../entity/entities/Trip';
import { TripMemberCash } from '../../entity/entities/TripMemberCash';
import { TripWithdrawal } from '../../entity/entities/TripWithdrawal';
import { Waug } from '../../entity/entities/Waug';
import { DataSource, In, Repository } from 'typeorm';
import { ShortLink } from '../../entity/entities/ShortLink';
import { Pagination } from '../paginate';
import { bufferToString, formatToYMD, parseDateRange, parseDateRangeYYYYMMDD, parseLinkPriceDate } from '../util/util';
import * as ExcelJS from 'exceljs';
import { AffiliateOrderType } from '../../entity/entities/AffiliateOrderType';
import { Affiliate } from '../../entity/entities/Affiliate';
import { AwsService } from '../aws/aws.service';
import { AffiliateCategory } from '../../entity/entities/AffiliateCategory';
import { TripDenyReason } from '../../entity/entities/TripDenyReason';
import { AffiliateImage } from '../../entity/entities/AffiliateImage';
import { AffiliateSvg } from '../../entity/entities/AffiliateSvg';
import { Agoda } from '../../entity/entities/Agoda';
import { Config } from '../../entity/entities/Config';
import { LinkpriceLog } from '../../entity/entities/LinkpriceLog';
import { MemberDevice } from '../../entity/entities/MemberDevice';
import { PushLog } from '../../entity/entities/PushLog';
import axios from 'axios';
import { getShortLink } from '../util/shortLink';
import { FcmService } from '../fcm/fcm.service';
import { MembershipManagementService } from '../membership_management/membership_management.service';
import { PigMemberCash } from '../../entity/secondary_entities/PigMemberCash';
import { RecommendMemberCash } from '../../entity/entities/RecommendMemberCash';
import { RecommendWithdrawal } from '../../entity/entities/RecommendWithdrawal';
import { ApiplexService } from '../apiplex/apiplex.service';
import { WairiFcmService } from '../wairi_fcm/wairi_fcm.service';
import { Response } from 'express';

@Injectable()
export class AffiliateService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(TripMemberCash)
    private readonly tripMemberCashRepository: Repository<TripMemberCash>,
    @InjectRepository(TripWithdrawal)
    private readonly tripWithdrawalRepository: Repository<TripWithdrawal>,
    @InjectRepository(Waug)
    private readonly waugRepository: Repository<Waug>,
    @InjectRepository(ShortLink)
    private readonly shortLinkRepository: Repository<ShortLink>,
    @InjectRepository(AffiliateOrderType)
    private readonly affiliateOrderTypeRepository: Repository<AffiliateOrderType>,
    @InjectRepository(Affiliate)
    private readonly affiliateRepository: Repository<Affiliate>,
    @InjectRepository(AffiliateCategory)
    private readonly affiliateCategoryRepository: Repository<AffiliateCategory>,
    @InjectRepository(TripDenyReason)
    private readonly tripDenyReasonRepository: Repository<TripDenyReason>,
    @InjectRepository(AffiliateSvg)
    private readonly affiliateSvgRepository: Repository<AffiliateSvg>,
    @InjectRepository(AffiliateImage)
    private readonly affiliateImageRepository: Repository<AffiliateImage>,
    @InjectRepository(Agoda)
    private readonly agodaRepository: Repository<Agoda>,
    @InjectRepository(Config)
    private readonly configRepository: Repository<Config>,
    @InjectRepository(LinkpriceLog)
    private readonly linkpriceLogRepository: Repository<LinkpriceLog>,
    @InjectRepository(MemberDevice)
    private readonly memberDeviceRepository: Repository<MemberDevice>,
    @InjectRepository(PushLog)
    private readonly pushLogRepository: Repository<PushLog>,
    @InjectRepository(PigMemberCash, 'secondaryConnection')
    private readonly pigMemberCashRepository: Repository<PigMemberCash>,
    @InjectRepository(RecommendMemberCash)
    private readonly recommendMemberCashRepository: Repository<RecommendMemberCash>,
    @InjectRepository(RecommendWithdrawal)
    private readonly recommendWithdrawalRepository: Repository<RecommendWithdrawal>,
    private readonly awsService: AwsService,
    private fcmService: FcmService, // FcmService 주입
    private wairiFcmService: WairiFcmService, // WairiFcmService 주입
    private dataSource: DataSource,
    private membershipManagementService: MembershipManagementService, // MembershipManagementService 주입
    private apiplexService: ApiplexService, // ApiplexService 주입
  ) {}

  async getAffiliateOrderType(params: any) {
    try {
      const type = params.type;
      //console.log('=>(affiliate.service.ts:39) type', type);
      const orderType = this.affiliateOrderTypeRepository.createQueryBuilder('affiliateOrderType');
      if (type) {
        orderType.andWhere('affiliateOrderType.type = :type', { type });
      }
      const orderTypes = await orderType.getMany();
      //console.log('=>(affiliate.service.ts:42) orderTypes', orderTypes);

      return orderTypes.map((orderType) => ({
        id: orderType.idx,
        key: orderType.key,
        name: orderType.name,
        created_at: orderType.created_at,
      }));
    } catch (e) {
      e.printStackTrace();
      throw new HttpException(e.message, e.status);
    }
  }

  async getShortLinkList(params: {
    id: string;
    name: string;
    phone: string;
    dates: string;
    page: number;
    take: number;
    order: string;
  }) {
    try {
      //console.log('=>(affiliate.service.ts:29) params', params);
      const { id, name, phone, dates, page, take, order } = params;

      const shortLink = this.shortLinkRepository.createQueryBuilder('shortLink');
      shortLink.leftJoin('shortLink.member', 'member', 'member.idx = shortLink.memberIdx');
      shortLink.leftJoin('shortLink.affiliate', 'affiliate', 'affiliate.idx = shortLink.division');
      shortLink.select([
        'shortLink.idx as idx',
        'shortLink.code as code',
        'shortLink.returnUrl as returnUrl',
        'shortLink.count as count',
        'shortLink.created_at as created_at',
        'shortLink.merchant_id as merchant_id',
        'member.id as memberId',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      // add select   'shortLink.division as division', 1은 트립 2는 와그로 표현
      //       shortLink.addSelect(
      //         `
      //   CASE shortLink.division
      //     WHEN 1 THEN '트립'
      //     WHEN 2 THEN '와그'
      //     ELSE '기타'
      //   END
      // `,
      //         'division',
      //       );
      shortLink.addSelect('affiliate.name as division');

      if (dates) {
        const date = parseDateRange(params.dates);
        if (date == null) {
          throw new HttpException('Invalid date range', 400);
        }
        const startDate = date.startDate;
        const endDate = date.endDate;
        shortLink.andWhere('shortLink.created_at >= :startDate', { startDate });
        shortLink.andWhere('shortLink.created_at <= :endDate', { endDate });
      }
      if (id) {
        shortLink.andWhere('member.id LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        shortLink.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        shortLink.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (order) {
        console.log('\x1b[97m\x1b[41m[CRITICAL] order:\x1b[0m', order);
        order == 'asc' ? shortLink.orderBy('shortLink.count', 'ASC') : shortLink.orderBy('shortLink.count', 'DESC');
      } else {
        shortLink.orderBy('shortLink.idx', 'DESC');
      }
      if (take) {
        shortLink.take(take);
      }
      if (page) {
        shortLink.skip((page - 1) * take);
      }

      const data = await shortLink
        .offset(take * (page - 1))
        .limit(take)
        .getRawMany();

      // created_at만 포맷 변환
      // data = data.map((item) => ({
      //   ...item,
      //   created_at: new Date(item.created_at.getTime() + 9 * 60 * 60 * 1000) // JS Date -> 수동 KST
      //     .toISOString()
      //     .replace('T', ' ')
      //     .substring(0, 19), // "YYYY-MM-DD HH:mm:ss" 형태
      // }));

      const total = await shortLink.getCount();
      const currentPage = page || 1;
      return new Pagination(
        {
          data,
          total,
          currentPage,
        },
        Number(take),
      );
    } catch (e) {
      console.log('=>(affiliate.service.ts:70) e', e);

      throw new HttpException(e.message, e.status);
    }
  }

  async exportExampleExcel(
    res,
    params: {
      id: string;
      name: string;
      phone: string;
      dates: string;
    },
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('발급 링크 리스트');

    // 헤더 설정
    worksheet.columns = [
      { header: 'No', key: 'no', width: 20 },
      { header: 'ID', key: 'id', width: 20 },
      { header: '이름', key: 'name', width: 20 },
      { header: '연락처', key: 'phone', width: 20 },
      { header: '이메일', key: 'email', width: 30 },
      { header: '코드', key: 'code', width: 30 },
      { header: '구분', key: 'division', width: 30 },
      { header: '링크', key: 'returnUrl', width: 30 },
      { header: '생성일', key: 'created_at', width: 30 },
      { header: '클릭수', key: 'count', width: 30 },
    ];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFECECEC' }, // 연회색
      };
      cell.font = {
        bold: true,
        color: { argb: 'FF000000' }, // 검정색
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const { id, name, phone, dates } = params;
    const shortLink = this.shortLinkRepository.createQueryBuilder('shortLink');
    shortLink.leftJoin('shortLink.member', 'member', 'member.idx = shortLink.memberIdx');
    shortLink.select([
      'shortLink.idx as idx',
      'shortLink.code as code',
      'shortLink.returnUrl as returnUrl',
      'shortLink.count as count',
      'shortLink.created_at as created_at',
      'member.id as memberId',
      'member.name as memberName',
      'member.phone as memberPhone',
      'member.email as memberEmail',
    ]);
    // add select   'shortLink.division as division', 1은 트립 2는 와그로 표현
    shortLink.addSelect(
      `
  CASE shortLink.division
    WHEN 1 THEN '트립'
    WHEN 2 THEN '와그'
    ELSE '기타'
  END
`,
      'division',
    );

    if (dates) {
      const date = parseDateRange(params.dates);
      if (date == null) {
        throw new HttpException('Invalid date range', 400);
      }
      const startDate = date.startDate;
      const endDate = date.endDate;
      shortLink.andWhere('shortLink.created_at >= :startDate', { startDate });
      shortLink.andWhere('shortLink.created_at <= :endDate', { endDate });
    }
    if (id) {
      shortLink.andWhere('member.id LIKE :id', { id: `%${id}%` });
    }
    if (name) {
      shortLink.andWhere('member.name LIKE :name', { name: `%${name}%` });
    }
    if (phone) {
      shortLink.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
    }
    shortLink.orderBy('shortLink.idx', 'DESC');
    const data = await shortLink.getRawMany();

    data.map((item, index) => {
      worksheet.addRow({
        no: index + 1,
        id: item.memberId,
        name: item.memberName,
        phone: item.memberPhone,
        email: item.memberEmail,
        code: item.code,
        division: item.division,
        returnUrl: item.returnUrl,
        created_at: item.created_at,
        count: item.count,
      });
    });
    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=example.xlsx');

    // 파일을 스트림으로 전송
    await workbook.xlsx.write(res);
    res.end();
  }

  async getTripReservation(params: {
    orderType: string;
    orderStatus: string;
    orderid: string;
    dates: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    page: number;
    take: number;
  }) {
    try {
      const { orderType, orderStatus, orderid, dates, id, name, phone, email, page, take } = params;
      const trip = this.tripRepository.createQueryBuilder('trip');
      trip.leftJoin('trip.member', 'member', 'member.id = trip.ouid');
      trip.leftJoin(
        'tripMemberCash',
        'tripMemberCash',
        'tripMemberCash.memberid = trip.ouid and tripMemberCash.orderid = trip.orderid',
      );
      trip.select([
        'trip.idx as idx',
        'trip.status as status',
        'trip.orderid as orderId',
        'trip.ouid as ouid',
        'trip.ordername as orderName',
        'trip.orderstatusid as orderStatusId',
        'trip.ordertype as ordertype',
        'trip.orderamount as orderAmount',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      //status 상태값 - 100: 예약, 400: 완료, 900: 취소
      trip.addSelect(
        `
  CASE trip.status
    WHEN 100 THEN '예약'
    WHEN 400 THEN '완료'
    WHEN 900 THEN '취소'
    ELSE '기타'
  END
`,
        'statusName',
      );
      trip.addSelect('FROM_UNIXTIME(trip.startdatetime + 86400)', 'startDateTime');
      trip.addSelect('FROM_UNIXTIME(trip.enddatetime + 86400)', 'endDateTime');
      trip.addSelect('FROM_UNIXTIME(trip.orderdate)', 'orderDate');
      trip.addSelect(
        "DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(trip.orderdate), '+00:00', '+09:00'), '%Y-%m-%d %H:%i:%s')",
        'orderDate',
      );
      trip.addSelect(
        "DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(trip.regdate), '+00:00', '+09:00'), '%Y-%m-%d %H:%i:%s')",
        'regdate',
      );
      trip.addSelect(
        "DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(trip.pushdate), '+00:00', '+09:00'), '%Y-%m-%d %H:%i:%s')",
        'pushdate',
      );
      trip.addSelect(
        `IF(
    trip.cancel > 0,
    DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(trip.cancel), '+00:00', '+09:00'), '%Y-%m-%d %H:%i:%s'),
    NULL
  )`,
        'cancelDate',
      );
      trip.addSelect('tripMemberCash.total as orderAmount');
      trip.addSelect('tripMemberCash.deposit as deposit');
      trip.addSelect('tripMemberCash.wairi_deposit as wairiDeposit');
      trip.addSelect('tripMemberCash.influence_deposit as influenceDeposit');

      if (orderType) {
        trip.andWhere('trip.ordertype = :orderType', { orderType });
      }
      if (orderStatus) {
        //console.log('=>(affiliate.service.ts:156) orderStatus', typeof orderStatus);
        if (orderStatus === '1') {
          //console.log('=>(affiliate.service.ts:156) orderStatus', orderStatus);
          // 예약 확정 상태 목록
          trip.andWhere('trip.orderstatusid IN (:...statusIds)', {
            statusIds: ['HOTEL_CONFIRMED', 'FLIGHT_TICKETED', 'ACTIVITY_DEALT', 'PIAO_COMPLETED'],
          });
        }
        if (orderStatus === '2') {
          // 취소 또는 미확정 상태 목록
          trip.andWhere('trip.orderstatusid IN (:...statusIds)', {
            statusIds: ['HOTEL_CANCELLED', 'FLIGHT_CANCELLED', 'ACTIVITY_UNSUBSCRIBED'],
          });
        }
      }
      if (orderid) {
        trip.andWhere('trip.orderid = :orderid', { orderid });
      }
      if (dates) {
        const date = parseDateRange(dates);
        //date startDate, endDate unix timestamp 형식 변환
        const startDate = new Date(date.startDate).getTime() / 1000;
        const endDate = new Date(date.endDate).getTime() / 1000; // 23:59:59로 설정

        trip.andWhere('trip.startdatetime >= :startDate', { startDate });
        trip.andWhere('trip.enddatetime <= :endDate', { endDate });
      }
      if (id) {
        trip.andWhere('trip.ouid LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        trip.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        trip.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        trip.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (page && take) {
        trip.offset(take * (page - 1)).limit(take);
      }
      trip.orderBy('trip.idx', 'DESC');

      const data = await trip
        // .offset(take * (page - 1))
        // .limit(take)
        .getRawMany();
      const total = await trip.getCount();

      // const sumQuery = trip.clone(); // 조건이 동일한 쿼리 복제
      // console.log(sumQuery);
      // sumQuery.select('SUM(trip.orderamount)', 'totalOrderAmount');
      // const sumResult = await sumQuery.getRawOne();
      // console.log(sumResult);
      // const totalOrderAmount = Number(sumResult?.totalOrderAmount || 0);

      //data 에서 orderAmount 합계 구하기
      const sumResult = data.reduce((acc, item) => acc + Number(item.orderAmount), 0);
      //console.log(sumResult);

      //trip orderAmount 합계 구하기
      const totalQuery = this.tripRepository
        .createQueryBuilder('trip')
        .select('SUM(trip.orderamount)', 'totalOrderAmount');
      const sumResultTotal = await totalQuery.getRawOne();
      //console.log(sumResultTotal);

      // const totalOrderAmount = Number(sumResultTotal.totalOrderAmount || 0);

      const totalOrderAmount = await this.totalOrderAmount(['trip']);
      const totalDepositAmount = await this.totalDeposit(['trip']);
      const totalWairiDepositAmount = await this.wairiDeposit(['trip']);
      const totalInfluencerDepositAmount = await this.influencerDeposit(['trip']);

      //data orderAmount string 변환

      data.forEach((item) => {
        item.orderAmount = item.orderAmount == null ? null : String(item.orderAmount);
      });
      const currentPage = page || 1;
      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalOrderAmount: Number(totalOrderAmount || 0),
        totalDepositAmount: Number(totalDepositAmount || 0),
        totalWairiDepositAmount: Number(totalWairiDepositAmount - totalInfluencerDepositAmount || 0),
        totalInfluencerDepositAmount: Number(totalInfluencerDepositAmount || 0),
      };
      // return new Pagination(
      //   {
      //     data,
      //     total,
      //     currentPage,
      //   },
      //   Number(take),
      // );
    } catch (e) {
      //console.log(e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getWaugReservation(params: {
    orderType: string;
    orderStatus: string;
    orderid: string;
    dates: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    page: number;
    take: number;
  }) {
    try {
      const { orderType, orderStatus, orderid, dates, id, name, phone, email, page, take } = params;

      const waug = this.waugRepository.createQueryBuilder('waug');
      waug.leftJoin('waug.member', 'member', 'member.id = waug.ouid');
      waug.leftJoin(
        'tripMemberCash',
        'tripMemberCash',
        'tripMemberCash.memberid = waug.ouid and tripMemberCash.orderid = waug.orderId',
      );
      waug.select([
        'waug.idx as idx',
        'waug.status as status',
        'waug.orderId as orderId',
        'waug.ouid as ouid',
        'waug.orderName as orderName',
        'waug.orderType as orderType',
        'waug.orderNumber as orderNumber',
        'waug.orderAmount as orderAmount',
        'waug.expectedUseDate as expectedUseDate',
        'waug.useProcessingDate as useProcessingDate',
        'waug.paySuccessDate as paySuccessDate',
        'waug.refundDate as refundDate',
        'waug.refundStatus as refundStatus',
        'waug.refundAmount as refundAmount',
        'waug.regdate as regdate',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      waug.addSelect('tripMemberCash.total as orderAmount');
      waug.addSelect('tripMemberCash.deposit as deposit');
      waug.addSelect('tripMemberCash.wairi_deposit as wairiDeposit');
      waug.addSelect('tripMemberCash.influence_deposit as influenceDeposit');
      if (orderType) {
        waug.andWhere('waug.orderType = :orderType', { orderType });
      }
      if (orderStatus) {
        if (orderStatus === '1') {
          // 결제 완료: useProcessingDate IS NOT NULL AND refundDate IS NULL
          waug.andWhere('waug.useProcessingDate IS NOT NULL');
          waug.andWhere('waug.refundDate IS NULL');
        } else if (orderStatus === '2') {
          // 결제 취소: refundDate IS NOT NULL
          waug.andWhere('waug.refundDate IS NOT NULL');
        }
      }
      if (orderid) {
        waug.andWhere('waug.orderId = :orderid', { orderid });
      }
      if (dates) {
        let parsed: string[];
        try {
          parsed = typeof dates === 'string' ? JSON.parse(dates) : dates;
        } catch (err) {
          throw new HttpException('Invalid dates format. Must be JSON array', 400);
        }

        if (!Array.isArray(parsed) || parsed.length < 2) {
          throw new HttpException('dates must be [startDate, endDate]', 400);
        }

        const [startDate, endDate] = parsed;
        waug.andWhere('DATE(waug.expectedUseDate) >= :startDate', { startDate });
        waug.andWhere('DATE(waug.expectedUseDate) <= :endDate', { endDate });
      }
      // if (dates) {
      //   let parsed: string[];
      //   try {
      //     parsed = JSON.parse(dates);
      //   } catch {
      //     throw new HttpException('dates must be a JSON array', 400);
      //   }
      //
      //   if (!Array.isArray(parsed) || parsed.length < 2) {
      //     throw new HttpException('dates must have at least [startDate, endDate]', 400);
      //   }
      //
      //   const [startDate, endDate] = parsed;
      //   waug.andWhere('DATE(waug.expectedUseDate) >= :startDate', { startDate });
      //   waug.andWhere('DATE(waug.expectedUseDate) <= :endDate', { endDate });
      // }

      if (id) {
        waug.andWhere('waug.ouid LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        waug.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        waug.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        waug.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (page && take) {
        waug.offset(take * (page - 1)).limit(take);
      }
      waug.orderBy('waug.idx', 'DESC');

      const data = await waug.getRawMany();
      const total = await waug.getCount();

      // const sumQuery = waug.clone(); // 조건이 동일한 쿼리 복제
      // sumQuery.select('SUM(waug.orderAmount)', 'totalOrderAmount');
      // const { totalOrderAmount } = await sumQuery.getRawOne();
      //data 에서 orderAmount 합계 구하기
      const sumResult = data.reduce((acc, item) => acc + Number(item.orderAmount), 0);
      //console.log(sumResult);

      //trip orderAmount 합계 구하기
      const totalQuery = this.waugRepository
        .createQueryBuilder('waug')
        .select('SUM(waug.orderAmount)', 'totalOrderAmount');
      const sumResultTotal = await totalQuery.getRawOne();
      // const totalOrderAmount = Number(sumResultTotal.totalOrderAmount || 0);
      const totalOrderAmount = await this.totalOrderAmount(['waug']);
      const totalDepositAmount = await this.totalDeposit(['waug']);
      const totalWairiDepositAmount = await this.wairiDeposit(['waug']);
      const totalInfluencerDepositAmount = await this.influencerDeposit(['waug']);

      //부분환불 금액 계산
      const totalPartialRefundOrderAmount = await this.totalPartialRefundOrderAmount(['waug']);
      const totalPartialRefundDepositAmount = await this.totalPartialRefundDepositAmount(['waug']);
      const totalPartialRefundWairiDepositAmount = await this.totalPartialRefundWairiDepositAmount(['waug']);
      const totalPartialRefundInfluencerDepositAmount = await this.totalPartialRefundInfluencerDepositAmount(['waug']);

      const currentPage = page || 1;
      console.log(
        '%%%%%%%%%%%%%%%' +
          Number(totalInfluencerDepositAmount || 0) +
          Number(totalPartialRefundInfluencerDepositAmount || 0),
      );
      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalOrderAmount: Number(totalOrderAmount ?? 0) + Number(totalPartialRefundOrderAmount ?? 0),
        totalDepositAmount: Number(totalDepositAmount ?? 0) + Number(totalPartialRefundDepositAmount ?? 0),
        totalWairiDepositAmount:
          Number((totalWairiDepositAmount ?? 0) - (totalInfluencerDepositAmount ?? 0)) +
          Number(totalPartialRefundWairiDepositAmount ?? 0),
        totalInfluencerDepositAmount:
          Number(totalInfluencerDepositAmount ?? 0) + Number(totalPartialRefundInfluencerDepositAmount ?? 0),
      };
      // return new Pagination(
      //   {
      //     data,
      //     total,
      //     currentPage,
      //   },
      //   Number(take),
      // );
    } catch (e) {
      console.log('=>(affiliate.service.ts:getWaugReservation) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getAgodaReservation(params: {
    orderStatus: string;
    orderid: string;
    dates: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    page: number;
    take: number;
  }) {
    try {
      const { orderStatus, orderid, dates, id, name, phone, email, page, take } = params;
      const agoda = this.agodaRepository.createQueryBuilder('agoda');
      agoda.leftJoin('agoda.member', 'member', 'member.id = agoda.tag');
      agoda.leftJoin(
        'tripMemberCash',
        'tripMemberCash',
        'tripMemberCash.memberid = agoda.tag and tripMemberCash.orderid = agoda.order_id',
      );
      agoda.select([
        'agoda.idx as idx',
        'agoda.order_id as order_id',
        'agoda.site_id as site_id',
        'agoda.site_name as site_name',
        'agoda.accommodation_name as accommodation_name',
        'agoda.accommodation_id as accommodation_id',
        'agoda.site_address as site_address',
        'agoda.city as city',
        'agoda.country as country',
        'agoda.reservation_date as reservation_date',
        'agoda.checkin_date as checkin_date',
        'agoda.checkout_date as checkout_date',
        'agoda.payment_date as payment_date',
        'agoda.dmc as dmc',
        'agoda.device_analysis as device_analysis',
        'agoda.tag as tag',
        'agoda.amount_before_tax as amount_before_tax',
        'agoda.krw_amount as krw_amount',
        'agoda.expected_fee as expected_fee',
        'agoda.krw_fee as krw_fee',
        'agoda.fee_rate as fee_rate',
        'agoda.final_fee as final_fee',
        'agoda.reservation_status as reservation_status',
        'agoda.regdate as regdate',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      agoda.addSelect('tripMemberCash.total as krw_amount');
      agoda.addSelect('tripMemberCash.deposit as deposit');
      agoda.addSelect('tripMemberCash.wairi_deposit as wairiDeposit');
      agoda.addSelect('tripMemberCash.influence_deposit as influenceDeposit');
      if (orderStatus) {
        if (orderStatus === '1') {
          // 결제 완료: checkout_date 오늘 날짜보다 큰
          agoda.andWhere('agoda.checkout_date > NOW()');
        } else if (orderStatus === '2') {
          // 결제 취소: reservation_status 'Cancelled' 포함되어있다면
          agoda.andWhere('agoda.reservation_status LIKE :reservationStatus', {
            reservationStatus: '%Cancelled%',
          });
        }
      }
      if (orderid) {
        agoda.andWhere('agoda.order_id = :orderid', { orderid });
      }
      if (dates) {
        const date = parseDateRange(dates);
        const startDate = date.startDate;
        const endDate = date.endDate;

        agoda.andWhere('agoda.checkin_date >= :startDate', { startDate });
        agoda.andWhere('agoda.checkout_date <= :endDate', { endDate });
      }
      if (id) {
        agoda.andWhere('agoda.tag LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        agoda.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        agoda.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        agoda.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (page && take) {
        agoda.offset(take * (page - 1)).limit(take);
      }
      agoda.orderBy('agoda.idx', 'DESC');
      const data = await agoda.getRawMany();
      const total = await agoda.getCount();
      const sumResult = data.reduce((acc, item) => acc + Number(item.amount_before_tax), 0);
      //console.log(sumResult);
      //agoda amount_before_tax 합계 구하기
      const totalQuery = this.agodaRepository
        .createQueryBuilder('agoda')
        .select('SUM(agoda.krw_amount)', 'totalOrderAmount');
      // config usd 환율

      const sumResultTotal = await totalQuery.getRawOne();
      //console.log(sumResultTotal);
      // const totalOrderAmount = Number(sumResultTotal.totalOrderAmount || 0);
      const totalOrderAmount = await this.totalOrderAmount(['agoda']);

      const totalDepositAmount = await this.totalDeposit(['agoda']);
      const totalWairiDepositAmount = await this.wairiDeposit(['agoda']);
      const totalInfluencerDepositAmount = await this.influencerDeposit(['agoda']);

      const exchange_rate = await this.configRepository.findOne({
        where: { cfgKey: 'Exchange_rate' },
      });
      const pay = this.setPay(totalOrderAmount, Number(exchange_rate.cfgValue));

      const currentPage = page || 1;
      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalOrderAmount: Number(totalOrderAmount || 0),
        totalDepositAmount: Number(totalDepositAmount || 0),
        totalWairiDepositAmount: Number(totalWairiDepositAmount - totalInfluencerDepositAmount || 0),
        totalInfluencerDepositAmount: Number(totalInfluencerDepositAmount || 0),
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getLinkPriceReservation(params: {
    merchant_id: string;
    orderStatus: string;
    orderid: string;
    dates: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    page: number;
    take: number;
  }) {
    try {
      const { merchant_id, orderStatus, orderid, dates, id, name, phone, email, page, take } = params;
      const linkPrice = this.linkpriceLogRepository.createQueryBuilder('linkpriceLog');
      linkPrice.leftJoin('linkpriceLog.member', 'member', 'member.id = linkpriceLog.affiliate_user_id');
      linkPrice.leftJoin('tripMemberCash', 'tripMemberCash', 'tripMemberCash.trlog_id = linkpriceLog.trlog_id');
      linkPrice.select([
        'linkpriceLog.*',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      linkPrice.addSelect('linkpriceLog.order_code as orderId');
      linkPrice.addSelect('linkpriceLog.status as statusName');
      // linkPrice.addSelect('linkpriceLog.price as orderAmount');
      linkPrice.addSelect('linkpriceLog.cancelDate as cancelDate');
      linkPrice.addSelect('linkpriceLog.created_at as regdate');
      //       linkPrice.addSelect(
      //         `
      //   STR_TO_DATE(CONCAT(linkpriceLog.day, linkpriceLog.time), '%Y%m%d%H%i%s')
      // `,
      //         'orderDate',
      //       );
      //       linkPrice.addSelect(
      //         `
      //   STR_TO_DATE(CONCAT(linkpriceLog.day, linkpriceLog.time), '%Y%m%d%H%i%s')
      // `,
      //         'full_timestamp',
      //       );
      linkPrice.addSelect(
        `
  CONVERT_TZ(
  STR_TO_DATE(CONCAT(day, time), '%Y%m%d%H%i%s'),
  '+00:00', '+09:00'
)
`,
        'orderDate',
      );
      linkPrice.addSelect(
        `
  CONVERT_TZ(
  STR_TO_DATE(CONCAT(day, time), '%Y%m%d%H%i%s'),
  '+00:00', '+09:00'
)
`,
        'full_timestamp',
      );
      linkPrice.addSelect('tripMemberCash.total as orderAmount');
      linkPrice.addSelect('tripMemberCash.deposit as deposit');
      linkPrice.addSelect('tripMemberCash.wairi_deposit as wairiDeposit');
      linkPrice.addSelect('tripMemberCash.influence_deposit as influenceDeposit');
      if (merchant_id) {
        // merchant_id가 있는 경우에만 필터링
        linkPrice.andWhere('linkpriceLog.merchant_id = :merchant_id', { merchant_id });
      }
      if (orderStatus) {
        if (orderStatus === '1') {
          // 결제 완료: checkout_date 오늘 날짜보다 큰
          linkPrice.andWhere('linkpriceLog.status = :division', { division: '400' });
        } else if (orderStatus === '2') {
          // 결제 취소: reservation_status 'Cancelled' 포함되어있다면
          linkPrice.andWhere('linkpriceLog.status = :reservationStatus', {
            reservationStatus: '900',
          });
        }
      }
      if (orderid) {
        linkPrice.andWhere('linkpriceLog.order_code like :orderid', { orderid: `%${orderid}%` });
        // queryBuilder.andWhere('admin.name LIKE :keyword', {
        //   keyword: `%${keyword}%`,
        // });
      }
      if (dates) {
        const date = parseDateRangeYYYYMMDD(dates);
        const startDate = date.startDate;
        const endDate = date.endDate;
        const startDay = startDate.replace(/-/g, ''); // "20250323"
        const endDay = endDate.replace(/-/g, ''); // "20250430"
        //linkpriceLog.day linkpriceLog.time 값을 합쳐서 날짜를 비교해야 하므로
        //linkpriceLog.day는 YYYYMMDD 형식, linkpriceLog.time은 HHMMSS 형식
        linkPrice.andWhere('linkpriceLog.day >= :startDay', { startDay });
        linkPrice.andWhere('linkpriceLog.day <= :endDay', { endDay });
        // agoda.andWhere('linkpriceLog.checkin_date >= :startDate', { startDate });
        // agoda.andWhere('linkpriceLog.checkout_date <= :endDate', { endDate });
      }
      if (id) {
        linkPrice.andWhere('linkpriceLog.affiliate_user_id LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        linkPrice.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        linkPrice.andWhere('member.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        linkPrice.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (page && take) {
        linkPrice.offset(take * (page - 1)).limit(take);
      }
      linkPrice.orderBy('full_timestamp', 'DESC');
      console.log('==========>take 🤩 : ', take);
      const data = await linkPrice.getRawMany();

      console.log(linkPrice.getQuery());

      const total = await linkPrice.getCount();
      const sumResult = data.reduce((acc, item) => acc + Number(item.amount_before_tax), 0);

      const totalQuery = this.linkpriceLogRepository
        .createQueryBuilder('linkpriceLog')
        .select('SUM(linkpriceLog.price)', 'totalOrderAmount');
      if (merchant_id) {
        // merchant_id가 있는 경우에만 필터링
        totalQuery.andWhere('linkpriceLog.merchant_id = :merchant_id', { merchant_id });
      }

      const sumResultTotal = await totalQuery.getRawOne();
      // const totalOrderAmount = Number(sumResultTotal.totalOrderAmount || 0);

      //총 커미션 금액
      const totalDepositQuery = this.linkpriceLogRepository
        .createQueryBuilder('linkpriceLog')
        .select('SUM(linkpriceLog.commision)', 'totalDepositAmount'); // alias 지정
      if (merchant_id) {
        // merchant_id가 있는 경우에만 필터링
        totalDepositQuery.andWhere('linkpriceLog.merchant_id = :merchant_id', { merchant_id });
      }
      const sumResultTotalDeposit = await totalDepositQuery.getRawOne();
      // const totalDepositAmount = Number(sumResultTotalDeposit.totalDepositAmount || 0);
      // console.log(totalDepositAmount);

      //affilate  linkpride 찾기
      const affiliate = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .select(['affiliate.idx as idx', 'affiliate.merchant_id as merchant_id'])
        .where('affiliate.linkprice = :linkprice', { linkprice: true })
        .getRawMany();

      //merchant_id가 있는 경우 where in 쿼리용 파라미터 생성
      const merchantIds = affiliate.map((item) => item.merchant_id);
      console.log('\x1b[97m\x1b[41m[CRITICAL] merchantIds:\x1b[0m', merchantIds);

      //와이리 커미션
      let totalOrderAmount = 0;
      let totalDepositAmount = 0;
      let totalWairiDepositAmount = 0;
      let totalInfluencerDepositAmount = 0;
      if (merchantIds.length > 0) {
        totalOrderAmount = await this.totalOrderAmount(merchantIds);
        totalDepositAmount = await this.totalDeposit(merchantIds);
        totalWairiDepositAmount = await this.wairiDeposit(merchantIds);
        //인플루언서 커미션
        totalInfluencerDepositAmount = await this.influencerDeposit(merchantIds);
      }

      const currentPage = page || 1;
      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalOrderAmount: Number(totalOrderAmount || 0),
        totalDepositAmount: Number(totalDepositAmount || 0),
        totalWairiDepositAmount: Number(totalWairiDepositAmount - totalInfluencerDepositAmount || 0),
        totalInfluencerDepositAmount: Number(totalInfluencerDepositAmount || 0),
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  public async totalOrderAmount(merchantIds) {
    const totalOrderAmount = this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.total)', 'totalOrderAmount')
      .where('tripMemberCash.division IN (:...merchantIds)', { merchantIds })
      .andWhere('tripMemberCash.cancelDate IS NULL');
    const sumResultTotalOrderAmount = await totalOrderAmount.getRawOne();
    console.log(
      `\x1b[97m\x1b[41m[CRITICAL] sumResultTotalOrderAmount ${merchantIds}:\x1b[0m`,
      sumResultTotalOrderAmount,
    );

    return Number(sumResultTotalOrderAmount?.totalOrderAmount ?? 0);
  }

  public async totalPartialRefundOrderAmount(merchantIds) {
    const waugPartialRefundQuery = this.waugRepository.createQueryBuilder('waug');
    waugPartialRefundQuery.select('waug.orderId', 'orderId');
    waugPartialRefundQuery.where('refundStatus = :refundStatus', { refundStatus: '부분환불' });
    const waugPartialRefunds = await waugPartialRefundQuery.getRawMany();

    const waugPartialRefundOrderIds = waugPartialRefunds.map((refund) => refund.orderId);
    console.log('\x1b[97m\x1b[41m[CRITICAL] waugPartialRefundOrderIds:\x1b[0m', waugPartialRefundOrderIds);

    // ✅ 빈 배열 방어
    if (!waugPartialRefundOrderIds.length) {
      return 0;
    }

    const refundAmount = await this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.total)', 'totalPartialRefundAmount')
      .where('tripMemberCash.orderid IN (:...waugPartialRefundOrderIds)', { waugPartialRefundOrderIds })
      .getRawOne();

    console.log('\x1b[97m\x1b[41m[CRITICAL] RefundAmount:\x1b[0m', refundAmount.totalPartialRefundAmount);
    return Number(refundAmount?.totalPartialRefundAmount ?? 0);
  }

  public async totalDeposit(merchantIds) {
    const totalDepositQuery = this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.deposit)', 'totalDepositAmount')
      .where('tripMemberCash.division IN (:...merchantIds)', { merchantIds })
      .andWhere('tripMemberCash.cancelDate IS NULL');
    const sumResultTotalDeposit = await totalDepositQuery.getRawOne();
    console.log(`\x1b[97m\x1b[41m[CRITICAL] sumResultTotalDeposit ${merchantIds}:\x1b[0m`, sumResultTotalDeposit);
    return Number(sumResultTotalDeposit?.totalDepositAmount ?? 0);
  }

  public async totalPartialRefundDepositAmount(merchantIds) {
    const waugPartialRefundQuery = this.waugRepository.createQueryBuilder('waug');
    waugPartialRefundQuery.select('waug.orderId', 'orderId');
    waugPartialRefundQuery.where('refundStatus = :refundStatus', { refundStatus: '부분환불' });
    const waugPartialRefunds = await waugPartialRefundQuery.getRawMany();

    const waugPartialRefundOrderIds = waugPartialRefunds.map((refund) => refund.orderId);
    console.log('\x1b[97m\x1b[41m[CRITICAL] waugPartialRefundOrderIds:\x1b[0m', waugPartialRefundOrderIds);

    // ✅ 빈 배열 방어
    if (!waugPartialRefundOrderIds || waugPartialRefundOrderIds.length === 0) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] No partial refund orders found.\x1b[0m');
      return 0;
    }

    const refundAmount = await this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.deposit)', 'totalPartialRefundDepositAmount')
      .where('tripMemberCash.orderid IN (:...waugPartialRefundOrderIds)', { waugPartialRefundOrderIds })
      .getRawOne();

    console.log('\x1b[97m\x1b[41m[CRITICAL] RefundAmount:\x1b[0m', refundAmount.totalPartialRefundDepositAmount);
    return Number(refundAmount?.totalPartialRefundDepositAmount ?? 0);
  }

  public async wairiDeposit(merchantIds) {
    const wairiDepositQuery = this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.wairi_deposit)', 'totalWairiDepositAmount')
      .where('tripMemberCash.division IN (:...merchantIds)', { merchantIds })
      .andWhere('tripMemberCash.cancelDate IS NULL');
    const sumResultTotalWairiDeposit = await wairiDepositQuery.getRawOne();
    console.log(
      `\x1b[97m\x1b[41m[CRITICAL] sumResultTotalWairiDeposit ${merchantIds}:\x1b[0m`,
      sumResultTotalWairiDeposit,
    );
    return Number(sumResultTotalWairiDeposit?.totalWairiDepositAmount ?? 0);
  }

  public async totalPartialRefundWairiDepositAmount(merchantIds) {
    const waugPartialRefundQuery = this.waugRepository.createQueryBuilder('waug');
    waugPartialRefundQuery.select('waug.orderId', 'orderId');
    waugPartialRefundQuery.where('refundStatus = :refundStatus', { refundStatus: '부분환불' });
    const waugPartialRefunds = await waugPartialRefundQuery.getRawMany();

    const waugPartialRefundOrderIds = waugPartialRefunds.map((refund) => refund.orderId);
    console.log('\x1b[97m\x1b[41m[CRITICAL] waugPartialRefundOrderIds:\x1b[0m', waugPartialRefundOrderIds);
    // ✅ orderIds가 비어 있으면 바로 0 반환
    if (!waugPartialRefundOrderIds || waugPartialRefundOrderIds.length === 0) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] No partial refund orders found for WairiDeposit.\x1b[0m');
      return 0;
    }
    const refundAmount = await this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.wairi_deposit)', 'totalPartialRefundWairiDepositAmount')
      .where('tripMemberCash.orderid IN (:...waugPartialRefundOrderIds)', { waugPartialRefundOrderIds })
      .getRawOne();

    console.log('\x1b[97m\x1b[41m[CRITICAL] RefundAmount:\x1b[0m', refundAmount.totalPartialRefundWairiDepositAmount);
    return Number(refundAmount?.totalPartialRefundWairiDepositAmount ?? 0);
  }

  public async influencerDeposit(merchantIds) {
    const influencerQuery = this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.influence_deposit)', 'totalInfluencerDepositAmount')
      .where('tripMemberCash.division IN (:...merchantIds)', { merchantIds })
      .andWhere('tripMemberCash.cancelDate IS NULL');
    const sumResultTotalInfluencerDeposit = await influencerQuery.getRawOne();
    console.log(
      `\x1b[97m\x1b[41m[CRITICAL] sumResultTotalInfluencerDeposit ${merchantIds}:\x1b[0m`,
      sumResultTotalInfluencerDeposit,
    );
    return Number(sumResultTotalInfluencerDeposit?.totalInfluencerDepositAmount ?? 0);
  }

  public async totalPartialRefundInfluencerDepositAmount(merchantIds) {
    const waugPartialRefundQuery = await this.waugRepository.createQueryBuilder('waug');
    waugPartialRefundQuery.select('waug.orderId', 'orderId');
    waugPartialRefundQuery.where('refundStatus = :refundStatus', { refundStatus: '부분환불' });
    const waugPartialRefunds = await waugPartialRefundQuery.getRawMany();

    const waugPartialRefundOrderIds = waugPartialRefunds.map((refund) => refund.orderId);
    console.log('\x1b[97m\x1b[41m[CRITICAL] waugPartialRefundOrderIds:\x1b[0m', waugPartialRefundOrderIds);
    // 🚨 배열이 비었으면 바로 return 0
    if (waugPartialRefundOrderIds.length === 0) {
      console.log('[CRITICAL] No partial refund orders found.');
      return 0;
    }

    const refundAmount = await this.tripMemberCashRepository
      .createQueryBuilder('tripMemberCash')
      .select('SUM(tripMemberCash.influence_deposit)', 'totalPartialRefundInfluencerDepositAmount')
      .where('tripMemberCash.orderid IN (:...waugPartialRefundOrderIds)', { waugPartialRefundOrderIds })
      .getRawOne();

    console.log(
      '\x1b[97m\x1b[41m[CRITICAL] RefundAmount:\x1b[0m',
      refundAmount.totalPartialRefundInfluencerDepositAmount,
    );
    return Number(refundAmount?.totalPartialRefundInfluencerDepositAmount ?? 0);
  }

  private setPay(amount_before_tax: number, exchange_rate: number) {
    try {
      //환율 계산 usd
      const pay = amount_before_tax * exchange_rate;
      return pay;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getWithdrawalApplicationList(params: {
    status: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    dates: string;
    page: number;
    take: number;
  }) {
    try {
      const { status, id, name, email, phone, dates, page, take } = params;
      //console.log('=>(affiliate.service.ts:292) params', params);

      const tripWithdrawal = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      tripWithdrawal.leftJoin('tripWithdrawal.member', 'member', 'member.idx = tripWithdrawal.memberIdx');
      tripWithdrawal.select([
        'tripWithdrawal.idx as idx',
        'tripWithdrawal.status as status',
        'tripWithdrawal.memberId as memberId',
        'tripWithdrawal.memberIdx as memberIdx',
        'tripWithdrawal.accountNumber as accountNumber',
        'tripWithdrawal.residentRegistrationNumber as residentRegistrationNumber',
        'tripWithdrawal.bankName as bankName',
        'tripWithdrawal.accountHolder as accountHolder',
        'tripWithdrawal.identificationCardImageKey as identificationCardImageKey',
        'tripWithdrawal.bankBookImageKey as bankBookImageKey',
        'tripWithdrawal.denyReason as denyReason',
        'tripWithdrawal.withdrawalAmount as withdrawalAmount',
        'tripWithdrawal.created_at as created_at',
        'tripWithdrawal.phone as phone',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      if (status) {
        // 신청 : 100
        // 완료 : 400
        // 취소 : 900
        // 거절 : -1
        tripWithdrawal.andWhere('tripWithdrawal.status = :status', { status });
      }
      if (dates) {
        const date = parseDateRange(dates);
        const startDate = date.startDate;
        const endDate = date.endDate;

        tripWithdrawal.andWhere('tripWithdrawal.created_at >= :startDate', { startDate });
        tripWithdrawal.andWhere('tripWithdrawal.created_at <= :endDate', { endDate });
      }
      if (id) {
        tripWithdrawal.andWhere('tripWithdrawal.memberId LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        tripWithdrawal.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        tripWithdrawal.andWhere('tripWithdrawal.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        tripWithdrawal.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (take) {
        tripWithdrawal.take(take);
      }
      if (page) {
        tripWithdrawal.skip((page - 1) * take);
      }
      tripWithdrawal.orderBy('tripWithdrawal.idx', 'DESC');

      const data = await tripWithdrawal
        .offset(take * (page - 1))
        .limit(take)
        .getRawMany();
      const total = await tripWithdrawal.getCount();

      // const sumQuery = tripWithdrawal.clone(); // 조건이 동일한 쿼리 복제
      // sumQuery.select('SUM(tripWithdrawal.withdrawalAmount)', 'totalWithdrawalAmount');
      // const { totalWithdrawalAmount } = await sumQuery.getRawOne();
      // console.log('=>(affiliate.service.ts:319) totalWithdrawalAmount', totalWithdrawalAmount);

      //data 에서 orderAmount 합계 구하기
      const sumResult = data.reduce((acc, item) => acc + Number(item.withdrawalAmount), 0);
      //console.log(sumResult);
      const totalWithdrawalAmount = Number(sumResult || 0);

      const currentPage = page || 1;

      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalWithdrawalAmount: Number(totalWithdrawalAmount || 0),
      };
      // return new Pagination(
      //   {
      //     data,
      //     total,
      //     currentPage,
      //   },
      //   Number(take),
      // );
    } catch (e) {
      //console.log('=>(affiliate.service.ts:313) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getWithdrawalApplicationDetail(params: { idx: number }) {
    try {
      const { idx } = params;
      const tripWithdrawal = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      tripWithdrawal.leftJoin('tripWithdrawal.member', 'member', 'member.idx = tripWithdrawal.memberIdx');
      tripWithdrawal.leftJoin('tripDenyReason', 'tripDenyReason', 'tripDenyReason.idx = tripWithdrawal.denyReason');
      tripWithdrawal.select([
        'tripWithdrawal.idx as idx',
        'tripWithdrawal.status as status',
        'tripWithdrawal.memberId as memberId',
        'tripWithdrawal.memberIdx as memberIdx',
        'tripWithdrawal.accountNumber as accountNumber',
        'tripWithdrawal.residentRegistrationNumber as residentRegistrationNumber',
        'tripWithdrawal.bankName as bankName',
        'tripWithdrawal.accountHolder as accountHolder',
        'tripWithdrawal.identificationCardImageKey as identificationCardImageKey',
        'tripWithdrawal.bankBookImageKey as bankBookImageKey',
        // 'tripWithdrawal.denyReason as denyReason',
        'tripWithdrawal.withdrawalAmount as withdrawalAmount',
        'tripWithdrawal.created_at as created_at',
        'tripWithdrawal.phone as phone',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
        'tripDenyReason.reason as denyReason',
      ]);
      tripWithdrawal.andWhere('tripWithdrawal.idx = :idx', { idx });
      const data = await tripWithdrawal.getRawOne();
      if (!data) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }
      const domain = 'https://saving-pig.s3.ap-northeast-2.amazonaws.com';
      const { identificationCardImageKey, bankBookImageKey } = data;
      const identificationCardImageUrl = `${domain}/${identificationCardImageKey}`;
      const bankBookImageUrl = `${domain}/${bankBookImageKey}`;
      data.identificationCardImageKey = identificationCardImageUrl;
      data.bankBookImageKey = bankBookImageUrl;
      //console.log('=>(affiliate.service.ts:353) data', data);
      return data;
    } catch (e) {
      e.printStackTrace();
      throw new HttpException(e.message, e.status);
    }
  }

  async changeWithdrawalStatus(params: { idx: number; status: number; denyReason: number }) {
    try {
      //console.log('=>(affiliate.service.ts:364) params', params);
      const idx = params.idx;
      const status = Number(params.status);
      const denyReason = params.denyReason ? params.denyReason : null;
      if (!idx) {
        throw new HttpException('idx 값이 없습니다.', 400);
      }
      const tripWithdrawal = await this.tripWithdrawalRepository.findOne({ where: { idx } });
      if (!tripWithdrawal) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }

      // 상태값 - 100: 신청, 400: 완료, 900: 취소, -1: 거절
      if (status !== 100 && status !== 400 && status !== 900 && status !== -1) {
        throw new HttpException('상태값이 잘못되었습니다.', 400);
      }

      if (status === -1 && !denyReason) {
        throw new HttpException('거절 사유를 입력해주세요.', 400);
      }

      tripWithdrawal.status = status;
      tripWithdrawal.denyReason = denyReason;
      tripWithdrawal.updatedAt = new Date();
      await this.tripWithdrawalRepository.save(tripWithdrawal);
    } catch (e) {
      //console.log('=>(affiliate.service.ts:392) e', e);
      e.printStackTrace();
      throw new HttpException(e.message, e.status);
    }
  }

  async getAffiliateManagement(keyword: string, page: number, take: number) {
    try {
      const affiliate = this.affiliateRepository.createQueryBuilder('affiliate');
      affiliate.select([
        'affiliate.idx AS idx',
        'affiliate.category AS category',
        'affiliateCategory.name AS categoryName',
        'affiliate.name AS name',
        'affiliate.merchant_id AS merchant_id',
        'affiliate.short_description AS short_description',
        'affiliate.icon_svg_url AS icon_svg_url',
        'affiliate.icon_svg_key AS icon_svg_key',
        'affiliate.landing_url AS landing_url',
        'affiliate.cookie_retention AS cookie_retention',
        'affiliate.commission_rate AS commission_rate',
        'affiliate.reward_timing AS reward_timing',
        'affiliate.withdrawal_timing AS withdrawal_timing',
        'affiliate.notes AS notes',
        'affiliate.has_event AS has_event',
        'affiliate.event_banner_url AS event_banner_url',
        'affiliate.event_banner_key AS event_banner_key',
        'affiliate.event_description AS event_description',
        'affiliate.event_period AS event_period',
        'affiliate.ordering AS ordering',
        'affiliate.linkprice AS linkprice',
        'affiliate.display AS display',
        'affiliate.created_at AS created_at',
        'affiliate.updated_at AS updated_at',
      ]);
      affiliate.leftJoin('affiliateCategory', 'affiliateCategory', 'affiliate.category = affiliateCategory.idx');
      if (keyword) {
        affiliate.andWhere('affiliate.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      const total = await affiliate.getCount();
      const totalPage = Math.ceil(total / take);
      if (page > totalPage) {
        throw new HttpException('Page not found', 404);
      }
      const data = await affiliate
        .orderBy('affiliate.ordering', 'ASC')
        .offset(take * (page - 1))
        .limit(take)
        .getRawMany();
      const currentPage = page;
      return new Pagination(
        {
          data,
          total,
          totalPage,
          currentPage,
        },
        Number(take),
      );
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getAffiliateManagementDetail(idx: number) {
    try {
      const affiliate = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .select('affiliate.*')
        .addSelect('affiliateCategory.name AS categoryName')
        .leftJoin('affiliateCategory', 'affiliateCategory', 'affiliate.category = affiliateCategory.idx')
        .where('affiliate.idx = :idx', { idx })
        .getRawOne();
      if (!affiliate) {
        throw new HttpException('Affiliate not found', 404);
      }
      const { icon_svg_key, event_banner_key } = affiliate;
      const icon_svg_url = `${process.env.AWS_S3_URL}/${icon_svg_key}`;
      const event_banner_url = `${process.env.AWS_S3_URL}/${event_banner_key}`;
      affiliate.icon_svg_key = icon_svg_key;
      affiliate.event_banner_key = event_banner_key;
      return affiliate;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getAffiliateManagementDetails(idx: number) {
    try {
      const affiliate = await this.affiliateRepository
        .createQueryBuilder('affiliate')
        .select('affiliate.*')
        .addSelect('affiliateCategory.name AS categoryName')
        .leftJoin('affiliateCategory', 'affiliateCategory', 'affiliate.category = affiliateCategory.idx')
        .where('affiliate.idx = :idx', { idx })
        .getRawOne();
      if (!affiliate) {
        throw new HttpException('Affiliate not found', 404);
      }
      const svgImage = await this.affiliateSvgRepository.findOne({ where: { affiliateIdx: idx } });
      const image = await this.affiliateImageRepository.find({
        where: { affiliateIdx: idx },
        order: { ordering: 'ASC' },
      });

      return {
        ...affiliate,
        svgImage,
        image,
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async createAffiliateManagement(
    files: { icon_svg?: Express.Multer.File[]; event_banner?: Express.Multer.File[] },
    body: any,
  ) {
    let icon_svg_data: any[] = [];
    let event_banner_data: any[] = [];
    try {
      //console.log('=>(affiliate.service.ts:487) files', files);
      //console.log('=>(affiliate.service.ts:488) body', body);
      const { icon_svg, event_banner } = files;

      if (icon_svg) {
        icon_svg_data = await this.awsService.uploadFilesSvg(icon_svg, 'affiliate_svg');
        body.icon_svg_key = icon_svg_data[0].key;
        body.icon_svg_url = icon_svg_data[0].url;
      }
      if (event_banner) {
        event_banner_data = await this.awsService.uploadFilesWebp(event_banner, 'affiliate_banner');
        body.event_banner_key = event_banner_data[0].key;
        body.event_banner_url = event_banner_data[0].url;
      }
      body.created_at = new Date();
      body.has_event = body.has_event;

      const insertAffiliate = await this.affiliateRepository.save(body);
      //console.log('=>(affiliate.service.ts:505) insertAffiliate', insertAffiliate);
      return {
        status: 200,
        message: '제휴사 관리 등록이 완료되었습니다.',
        data: {
          idx: insertAffiliate.idx,
          icon_svg_key: body.icon_svg_key,
          event_banner_key: body.event_banner_key,
        },
      };
    } catch (e) {
      //console.log('=>(affiliate.service.ts:508) e', e);
      if (icon_svg_data?.[0]?.key) {
        await this.awsService.deleteFiles([icon_svg_data[0].key]);
      }
      if (event_banner_data?.[0]?.key) {
        await this.awsService.deleteFiles([event_banner_data[0].key]);
      }
      throw new HttpException(e.message, e.status);
    }
  }

  async createAffiliateManagements(
    files: { icon_svg?: Express.Multer.File[]; event_banner?: Express.Multer.File[] },
    body: any,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      //console.log('=>(affiliate.service.ts:487) files', files);
      //console.log('=>(affiliate.service.ts:488) body', body);
      const affiliate = await this.makeAffiliateObject(body);

      //console.log('=>(affiliate.service.ts:490) affiliate', affiliate);
      const insertedAffiliate = await queryRunner.manager.save(affiliate);
      //console.log('=>(affiliate.service.ts:492) insertedAffiliate', insertedAffiliate);

      if (!insertedAffiliate) {
        throw new HttpException('제휴사 등록에 실패했습니다.', 500);
      }

      const affiliateImageOrderMax = await this.affiliateImageRepository
        .createQueryBuilder('affiliateImage')
        .select('MAX(affiliateImage.ordering)', 'max')
        .where('affiliateImage.affiliateIdx = :affiliateIdx', { affiliateIdx: body.campaignIdx })
        .getRawOne();
      //console.log('=>(campaign.service.ts:409) affiliateImageOrderMax', affiliateImageOrderMax.max);

      if (files.icon_svg) {
        const iconSvgLength = Object.keys(files.icon_svg).length;
        if (iconSvgLength === 1) {
          const icon_svg_data = await this.awsService.uploadFilesSvg(files.icon_svg, 'affiliate_svg');
          //console.log(icon_svg_data);
          await Promise.all(
            icon_svg_data.map(async (fileData) => {
              const svgImage = this.createSvgImages(fileData, insertedAffiliate.idx, 1);
              await queryRunner.manager.save(svgImage);
            }),
          );
        }
      }
      if (files.event_banner) {
        const eventBannerLength = Object.keys(files.event_banner).length;
        if (eventBannerLength === 1) {
          const event_banner_data = await this.awsService.uploadFilesWebp(files.event_banner, 'affiliate_banner');
          //console.log(event_banner_data);
          await Promise.all(
            event_banner_data.map(async (fileData) => {
              const eventBannerImage = this.createAffiliateImages(
                fileData,
                insertedAffiliate.idx,
                affiliateImageOrderMax.max + 1,
              );
              await queryRunner.manager.save(eventBannerImage);
            }),
          );
        }
        if (eventBannerLength > 1) {
          const event_banner_data = await this.awsService.uploadFilesWebps(files.event_banner, 'affiliate_banner');
          //console.log(event_banner_data);
          await Promise.all(
            event_banner_data.map(async (fileData, index) => {
              const eventBannerImage = this.createAffiliateImages(
                fileData,
                insertedAffiliate.idx,
                affiliateImageOrderMax.max + index + 1,
              );
              await queryRunner.manager.save(eventBannerImage);
            }),
          );
        }
      }

      await queryRunner.commitTransaction();

      const affiliateSvgImage = await this.affiliateSvgRepository.find({
        where: { affiliateIdx: insertedAffiliate.idx },
      });
      const affiliateBannerImage = await this.affiliateImageRepository.find({
        where: { affiliateIdx: insertedAffiliate.idx },
      });

      return {
        status: 200,
        message: 'Affiliate created successfully',
        affiliateIdx: insertedAffiliate.idx,
        affiliateSvgImage: affiliateSvgImage,
        affiliateBannerImage: affiliateBannerImage,
      };
    } catch (e) {
      //console.log(e);
      await queryRunner.rollbackTransaction();
      throw new HttpException(e.message, e.status);
    } finally {
      await queryRunner.release();
    }
  }

  private async makeAffiliateObject(body: any) {
    //Affiliate ordering 찾기
    const maxOrdering = this.affiliateRepository
      .createQueryBuilder('affiliate')
      .select('MAX(affiliate.ordering)', 'max')
      .getRawOne()
      .then((result) => {
        return result.max ? Number(result.max) + 1 : 1; // 기본값 1
      });
    const affiliate = new Affiliate();
    affiliate.category = body.category;
    affiliate.name = body.name;
    affiliate.short_description = body.short_description;
    affiliate.landing_url = body.landing_url;
    affiliate.cookie_retention = body.cookie_retention;
    affiliate.commission_rate = body.commission_rate;
    affiliate.reward_timing = body.reward_timing;
    affiliate.withdrawal_timing = body.withdrawal_timing;
    affiliate.notes = body.notes;
    affiliate.has_event = body.has_event;
    affiliate.event_description = body.event_description;
    affiliate.event_period = body.event_period;
    affiliate.ordering = await maxOrdering;
    affiliate.created_at = new Date();
    return affiliate;
  }

  private createAffiliateImages(data: any, affiliateIdx: number, ordering: number = 1) {
    const affiliateImage = new AffiliateImage();
    affiliateImage.affiliateIdx = affiliateIdx;
    affiliateImage.file_name = data.fileName;
    affiliateImage.orig_name = data.originalname;
    affiliateImage.aws_key = data.key;
    affiliateImage.aws_url = data.url;
    affiliateImage.ordering = ordering;
    affiliateImage.created_at = new Date();
    // affiliateImage.type = 'event_banner';
    return affiliateImage;
  }

  private createSvgImages(data: any, affiliateIdx: number, ordering: number = 1) {
    const affiliateSvg = new AffiliateSvg();
    affiliateSvg.affiliateIdx = affiliateIdx;
    affiliateSvg.file_name = data.fileName;
    affiliateSvg.orig_name = data.originalname;
    affiliateSvg.aws_key = data.key;
    affiliateSvg.aws_url = data.url;
    affiliateSvg.ordering = ordering;
    affiliateSvg.created_at = new Date();
    // affiliateImage.type = 'icon_svg';
    return affiliateSvg;
  }

  async updateAffiliateManagement(
    files: {
      icon_svg?: Express.Multer.File[];
      event_banner?: Express.Multer.File[];
    },
    body: any,
  ) {
    let icon_svg_data: any[] = [];
    let event_banner_data: any[] = [];
    let oldDataSvg: any;
    let oldDataBanner: any;
    try {
      //console.log('=>(affiliate.service.ts:525) files', files);
      //console.log('=>(affiliate.service.ts:526) body', body);
      const { icon_svg, event_banner } = files;

      if (icon_svg) {
        icon_svg_data = await this.awsService.uploadFilesSvg(icon_svg, 'affiliate_svg');
        //기존 파일 key
        oldDataSvg = await this.affiliateRepository.findOne({
          where: { idx: body.idx },
        });
        body.icon_svg_key = icon_svg_data[0].key;
        body.icon_svg_url = icon_svg_data[0].url;
      }
      if (event_banner) {
        event_banner_data = await this.awsService.uploadFilesWebp(event_banner, 'affiliate_banner');
        //기존 파일 key
        oldDataBanner = await this.affiliateRepository.findOne({
          where: { idx: body.idx },
        });
        body.event_banner_key = event_banner_data[0].key;
        body.event_banner_url = event_banner_data[0].url;
      }
      body.updated_at = new Date();
      body.has_event = body.has_event;

      await this.affiliateRepository.update(body.idx, body);
      if (icon_svg && icon_svg_data.length > 0) {
        //기존 파일 삭제
        if (oldDataSvg.icon_svg_key) {
          await this.awsService.deleteFiles([oldDataSvg.icon_svg_key]);
        }
      }
      if (event_banner && event_banner_data.length > 0) {
        //기존 파일 삭제
        if (oldDataBanner.event_banner_key) {
          await this.awsService.deleteFiles([oldDataBanner.event_banner_key]);
        }
      }

      return {
        status: 200,
        message: '제휴사 관리 수정이 완료되었습니다.',
        data: {
          idx: body.idx,
          icon_svg_key: body.icon_svg_key,
          event_banner_key: body.event_banner_key,
        },
      };
    } catch (e) {
      //console.log('=>(affiliate.service.ts:556) e', e);
      if (icon_svg_data?.[0]?.key) {
        await this.awsService.deleteFiles([icon_svg_data[0].key]);
      }
      if (event_banner_data?.[0]?.key) {
        await this.awsService.deleteFiles([event_banner_data[0].key]);
      }
      throw new HttpException(e.message, e.status);
    }
  }

  async updateAffiliateManagements(
    files: { icon_svg?: Express.Multer.File[]; event_banner?: Express.Multer.File[] },
    body: any,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 제휴사 존재 여부 확인
      const idx = body.idx;
      const affiliate = await this.affiliateRepository.findOne({
        where: { idx },
      });
      if (!affiliate) {
        throw new HttpException('Affiliate not found', 404);
      }

      const filesArray = Array.isArray(files.event_banner)
        ? files.event_banner
        : (Object.values(files.event_banner) as Express.Multer.File[]);

      let orderArray: string[];
      let deleteImageArray: string[];
      let deleteSvgArray: string[];
      if (typeof body.imageOrder === 'string') {
        orderArray = JSON.parse(body.imageOrder); // 문자열을 배열로 변환
      } else {
        orderArray = body.imageOrder; // 이미 배열일 경우 그대로 사용
      }
      if (typeof body.deleteImageKey === 'string') {
        deleteImageArray = JSON.parse(body.deleteImageKey); // 문자열을 배열로 변환
      } else {
        deleteImageArray = body.deleteImageKey; // 이미 배열일 경우 그대로 사용
      }
      if (typeof body.deleteSvgKey === 'string') {
        deleteSvgArray = JSON.parse(body.deleteSvgKey); // 문자열을 배열로 변환
      } else {
        deleteSvgArray = body.deleteSvgKey; // 이미 배열일 경우 그대로 사용
      }

      const uniqueOrderArray = [...new Set(orderArray)]; // 중복 제거

      console.log('\x1b[97m\x1b[41m[CRITICAL] deleteImageArray:\x1b[0m', deleteImageArray);
      console.log('\x1b[97m\x1b[41m[CRITICAL] deleteSvgArray:\x1b[0m', deleteSvgArray);
      console.log('\x1b[97m\x1b[41m[CRITICAL] orderArray:\x1b[0m', orderArray);
      console.log('\x1b[97m\x1b[41m[CRITICAL] uniqueOrderArray:\x1b[0m', uniqueOrderArray);

      let currentOrder = 1;
      for (const fileNameOrAwsKey of uniqueOrderArray) {
        if (fileNameOrAwsKey.startsWith('affiliate_banner/')) {
          //기존 파일 오더링
          const affiliateImage = await this.affiliateImageRepository.findOne({
            where: { aws_key: fileNameOrAwsKey },
          });
          affiliateImage.ordering = currentOrder;
          await queryRunner.manager.save(affiliateImage);
        } else {
          // 새 파일 처리
          const name = fileNameOrAwsKey?.trim().normalize('NFC');
          const matchingFile = filesArray.find((f) => f.originalname.trim().normalize('NFC') === name);

          if (matchingFile) {
            //aws upload
            const fileData = await this.awsService.uploadFilesWebp([matchingFile], 'affiliate_banner');
            const newAffiliateImage = this.createAffiliateImages(fileData[0], idx, currentOrder);
            await queryRunner.manager.save(newAffiliateImage);
          }
          // console.log('filesArray', filesArray);
          // console.log('fileNameOrAwsKey', fileNameOrAwsKey);
          // const name = fileNameOrAwsKey.originalname?.trim().normalize('NFC'); // 안전하게 정규화
          // // fileNameOrAwsKey 순2회해서 orderArray 에 있는지 확인 후 인덱스 값 가져오기
          // console.log(fileNameOrAwsKey.originalname);
          // const index = uniqueOrderArray.findIndex((o) => o.trim().normalize('NFC') === name);
          // console.log(`[Match Check] ${name} -> Index: ${index}`);
        }
        currentOrder++;
      }

      //aws 삭제 디비 삭제
      // if (deleteImageArray && deleteImageArray.length > 0) {
      //   await this.awsService.deleteFiles(deleteImageArray);
      //   // 삭제된 키들을 affiliateImage에서 제거
      //   await queryRunner.manager.delete(AffiliateImage, { aws_key: In(deleteImageArray) });
      // }

      //제휴사 정보 수정
      const affiliateUpdateData = {
        category: body.category,
        name: body.name,
        short_description: body.short_description,
        landing_url: body.landing_url,
        cookie_retention: body.cookie_retention,
        commission_rate: body.commission_rate,
        reward_timing: body.reward_timing,
        withdrawal_timing: body.withdrawal_timing,
        notes: body.notes,
        has_event: body.has_event,
        event_description: body.event_description,
        event_period: body.event_period,
        updated_at: new Date(),
      };

      //제휴사 업데이트
      await queryRunner.manager.update(Affiliate, idx, affiliateUpdateData);

      await queryRunner.commitTransaction();
      return {
        status: 200,
        message: '제휴사 관리 수정이 완료 되었습니다.',
        data: {
          affiliateUpdateData,
        },
      };
    } catch (e) {
      //console.log(e);
      await queryRunner.rollbackTransaction();
      throw new HttpException(e.message, e.status);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAffiliateManagement(idx: number) {
    try {
      const affiliate = await this.affiliateRepository.findOne({
        where: { idx },
      });
      if (!affiliate) {
        throw new HttpException('Affiliate not found', 404);
      }
      const { icon_svg_key, event_banner_key } = affiliate;
      if (icon_svg_key) {
        await this.awsService.deleteFiles([icon_svg_key]);
      }
      if (event_banner_key) {
        await this.awsService.deleteFiles([event_banner_key]);
      }
      await this.affiliateRepository.delete({ idx });
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getCategory(keyword: string) {
    try {
      const affiliateCategory = this.affiliateCategoryRepository.createQueryBuilder('affiliateCategory');
      affiliateCategory.select([
        'affiliateCategory.idx AS idx',
        'affiliateCategory.name AS name',
        'affiliateCategory.created_at AS created_at',
        'affiliateCategory.updated_at AS updated_at',
      ]);
      if (keyword) {
        affiliateCategory.andWhere('affiliateCategory.name LIKE :keyword', { keyword: `%${keyword}%` });
      }
      const data = await affiliateCategory.getRawMany();
      return data;
    } catch (e) {
      //console.log('=>(affiliate.service.ts:598) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getCategoryDetail(idx: number) {
    try {
      const affiliateCategory = await this.affiliateCategoryRepository.findOne({
        where: { idx },
      });
      if (!affiliateCategory) {
        throw new HttpException('Affiliate category not found', 404);
      }
      return affiliateCategory;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async createCategory(params: any) {
    try {
      const { name } = params;
      if (!name) {
        throw new HttpException('카테고리 이름을 입력해주세요.', 400);
      }
      const body = {
        name,
        created_at: new Date(),
      };
      await this.affiliateCategoryRepository.save(body);

      return {
        status: 200,
        message: '제휴사 카테고리 등록이 완료되었습니다.',
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async updateCategory(params: any) {
    try {
      const { idx, name } = params;
      if (!idx) {
        throw new HttpException('idx 값이 없습니다.', 400);
      }
      if (!name) {
        throw new HttpException('카테고리 이름을 입력해주세요.', 400);
      }
      const body = {
        name,
      };
      await this.affiliateCategoryRepository.update(idx, body);

      return {
        status: 200,
        message: '제휴사 카테고리 수정이 완료되었습니다.',
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async deleteCategory(idx: number) {
    try {
      const affiliateCategory = await this.affiliateCategoryRepository.findOne({
        where: { idx },
      });
      //console.log(affiliateCategory);
      if (!affiliateCategory) {
        throw new HttpException('Affiliate category not found', 404);
      }
      await this.affiliateCategoryRepository.delete({ idx });

      return {
        status: 200,
        message: '제휴사 카테고리 삭제가 완료되었습니다.',
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getTripDenyReasons() {
    try {
      const tripDenyReason = this.tripDenyReasonRepository.createQueryBuilder('tripDenyReason');
      tripDenyReason.select([
        'tripDenyReason.idx as idx',
        'tripDenyReason.reason as reason',
        'tripDenyReason.created_at as created_at',
      ]);
      const data = await tripDenyReason.getRawMany();
      return data;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async deleteWithdrawal(idx: number) {
    try {
      const tripWithdrawal = await this.tripWithdrawalRepository.findOne({
        where: { idx },
      });
      if (!tripWithdrawal) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }
      await this.tripWithdrawalRepository.delete({ idx });
      return {
        status: 200,
        message: '출금 신청 내역 삭제가 완료되었습니다.',
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async updateAffiliateOrder(body: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const item = body.item;
      await Promise.all(
        item.map(async (item, index) => {
          await queryRunner.manager
            .createQueryBuilder()
            .update(Affiliate)
            .set({ ordering: item.ordering })
            .where('idx = :idx', { idx: item.idx })
            .execute();
        }),
      );

      await queryRunner.commitTransaction();

      return {
        status: 200,
        message: 'Affiliate sorted successfully',
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(e.message, e.status);
    } finally {
      await queryRunner.release();
    }
  }

  async receiveLinkPriceData(body: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const {
        day,
        time,
        merchant_id,
        order_code,
        product_code,
        product_name,
        category_code,
        item_count,
        price,
        commision,
        affiliate_id,
        affiliate_user_id,
        trlog_id,
        base_commission,
        incentive_commission,
      } = body;

      //merchant_id 로 affiliate 테이블에서 actual_commission_ratio 찾기
      const affiliate = await this.affiliateRepository.findOne({
        where: { merchant_id },
      });

      // const base_commission_ratio = affiliate.actual_commission_ratio || 0;

      //아시아 시간 +9 보정
      const now = new Date();
      const asiaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      console.log('\x1b[30m\x1b[106m[INFO] asiaTime:\x1b[0m', asiaTime);

      //linkpricelog 저장
      const linkPriceLog = new LinkpriceLog();
      linkPriceLog.day = day;
      linkPriceLog.time = time;
      linkPriceLog.status = '100';
      linkPriceLog.merchant_id = merchant_id;
      linkPriceLog.order_code = order_code;
      linkPriceLog.product_code = product_code;
      linkPriceLog.product_name = decodeURIComponent(product_name);
      linkPriceLog.category_code = category_code;
      linkPriceLog.item_count = item_count;
      linkPriceLog.price = price;
      linkPriceLog.commision = commision;
      linkPriceLog.affiliate_id = affiliate_id;
      linkPriceLog.affiliate_user_id = affiliate_user_id;
      linkPriceLog.trlog_id = trlog_id;
      linkPriceLog.base_commission = base_commission;
      linkPriceLog.incentive_commission = incentive_commission;
      linkPriceLog.created_at = now.toISOString();
      await this.linkpriceLogRepository.save(linkPriceLog); // Todo linkpriceLog 저장

      //커미션 계산
      const commisionAmount = Math.floor(commision * 0.8);
      const wairi_deposit = Math.floor(commision * 0.2);

      const tripMemberCashCheck = await this.tripMemberCashCheck(affiliate_user_id, trlog_id, '');
      console.log('\x1b[97m\x1b[41m[CRITICAL] tripMemberCashCheck11111111:\x1b[0m', tripMemberCashCheck);
      const dateObj = parseLinkPriceDate(day, time);
      if (tripMemberCashCheck) {
        // ✅ 기존 레코드 업데이트
        const tripMemberCash = new TripMemberCash();
        tripMemberCash.idx = tripMemberCashCheck.idx; // 기존 레코드의 idx를 사용
        tripMemberCash.memberId = affiliate_user_id;
        tripMemberCash.orderid = order_code;
        tripMemberCash.trlog_id = trlog_id;
        tripMemberCash.deposit = commisionAmount;
        tripMemberCash.wairi_deposit = wairi_deposit;
        tripMemberCash.influence_deposit = 0;
        tripMemberCash.total = price;
        tripMemberCash.withdrawal = 0; // Assuming withdrawal is 0 for updates
        tripMemberCash.orderDate = dateObj;
        tripMemberCash.cancelDate = null; // Assuming cancelDate is null for updates
        tripMemberCash.created_at = now.toISOString();
        tripMemberCash.title = decodeURIComponent(product_name);
        tripMemberCash.division = merchant_id;

        await queryRunner.manager.save(tripMemberCash);
      } else {
        // ✅ 새 레코드 저장
        const tripMemberCash = new TripMemberCash();
        tripMemberCash.memberId = affiliate_user_id;
        tripMemberCash.orderid = order_code;
        tripMemberCash.trlog_id = trlog_id;
        tripMemberCash.deposit = commisionAmount;
        tripMemberCash.wairi_deposit = wairi_deposit;
        tripMemberCash.influence_deposit = 0;
        tripMemberCash.total = price;
        tripMemberCash.withdrawal = 0;
        tripMemberCash.orderDate = dateObj;
        tripMemberCash.cancelDate = null;
        tripMemberCash.created_at = now.toISOString();
        tripMemberCash.title = decodeURIComponent(product_name);
        tripMemberCash.division = merchant_id;

        await queryRunner.manager.save(tripMemberCash);

        //Todo 결제 완료 알림
        //merchant_id 로 네임 찾기
        const merchantName = await this.affiliateRepository
          .createQueryBuilder('affiliate')
          .select('affiliate.name as name')
          .where('merchant_id = :merchant_id', { merchant_id: merchant_id })
          .getRawOne();

        const member = await this.memberRepository
          .createQueryBuilder('member')
          .select('member.phone as phone')
          .addSelect('member.agreeMsg as agreeMsg')
          .where('member.id = :affiliate_user_id', { affiliate_user_id: affiliate_user_id })
          .getRawOne();
        console.log('\x1b[97m\x1b[41m[CRITICAL] member:\x1b[0m', member);
        if (member.agreeMsg == 1) {
          const param = {
            제휴처명: merchantName.name,
            적립금: commisionAmount,
            초대리워드: 'https://pigback-22226.web.app/?target=affiliate&deep_link_sub1=2',
          };
          // this.apiplexService.sendPigUserAlimtalk('h56189d9g95g', member.phone, param);
          this.apiplexService.sendPigUserAlimtalk('nl3oy9flgskf', member.phone, param);
        }
      }

      const wairi_member = await this.membershipManagementService.checkWairiRecommended(affiliate_user_id);
      console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_member:\x1b[0m', wairi_member);

      if (wairi_member) {
        await this.wairiRecommenderCommission(body, commisionAmount, wairi_deposit, wairi_member, queryRunner);

        //Todo wairi 알림톡
        if (wairi_member.recommended_code) {
          const wairi_member_info = await this.membershipManagementService.getWairiMemberInfo(
            wairi_member.recommended_code,
          );
          console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_member_info:\x1b[0m', wairi_member_info);
          console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_deposit:\x1b[0m', wairi_deposit);
          const param = {
            '돈벌기 내 절약돼지탭': 'https://wairi-bd980.web.app/?target=affiliatehistory&deep_link_sub1=2',
          };
          const talk = await this.apiplexService.sendUserAlimtalk('th38adfhkgha', wairi_member_info.phone, param);
          //Todo 푸시
          await this.wairiFcmService.pushData({
            ouid: wairi_member_info.id,
            orderid: order_code,
            merchant_id: merchant_id,
            resultKRW: wairi_deposit,
          });
        }
      }

      //절약돼지 추천인 등록 여부 체크
      const purchasing_member = await this.purchasingMemberCheck(affiliate_user_id);
      console.log('\x1b[97m\x1b[41m[CRITICAL] purchasing_member:\x1b[0m', purchasing_member);

      if (purchasing_member && !wairi_member) {
        const recommended_code = purchasing_member.refererRootInput;
        await this.savingPigRecommenderCommission(recommended_code, body, commisionAmount, wairi_deposit, queryRunner);
      }

      await queryRunner.commitTransaction();
      // FCM 알림 전송
      await this.pushLinkPriceData({
        ouid: affiliate_user_id,
        orderid: order_code,
        merchant_id: merchant_id,
        resultKRW: commisionAmount,
      });

      return {
        status: 200,
        message: 'LinkPrice data received successfully',
      };
    } catch (e) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] Error in receiveLinkPriceData:\x1b[0m', e);
      throw new HttpException(e.message, e.status);
    } finally {
      await queryRunner.release();
    }
  }

  //절약돼지 추천인 등록 여부 체크
  async purchasingMemberCheck(affiliate_user_id: string) {
    try {
      return await this.memberRepository
        .createQueryBuilder('member')
        .select('*')
        .where('member.id = :affiliate_user_id', { affiliate_user_id: affiliate_user_id })
        .andWhere('member.refererRoot = :refererRoot', { refererRoot: 4 })
        .getRawOne();
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async tripMemberCashCheck(affiliate_user_id: string, trlog_id: string = '', orderid: string = '') {
    try {
      const query = this.tripMemberCashRepository.createQueryBuilder('tripMemberCash');
      query.select('*');
      query.where('tripMemberCash.memberId = :affiliate_user_id', { affiliate_user_id: affiliate_user_id });
      if (trlog_id !== null && trlog_id !== undefined && trlog_id !== '') {
        query.andWhere('tripMemberCash.trlog_id = :trlog_id', { trlog_id: String(trlog_id) });
      }
      if (orderid !== null && orderid !== undefined && orderid !== '') {
        query.andWhere('tripMemberCash.orderid = :orderid', { orderid: orderid });
      }

      const tripMemberCash = await query.getRawOne();
      console.log('\x1b[97m\x1b[41m[CRITICAL] tripMemberCashCheck:\x1b[0m', tripMemberCash);
      return tripMemberCash;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  //절약돼지 추천인 커미션 등록
  async savingPigRecommenderCommission(
    recommended_code: string,
    body: any,
    commisionAmount: number,
    wairi_deposit: number,
    queryRunner,
  ) {
    try {
      const {
        day,
        time,
        merchant_id,
        order_code,
        product_code,
        product_name,
        category_code,
        item_count,
        price,
        commision,
        affiliate_id,
        affiliate_user_id,
        trlog_id,
        base_commission,
        incentive_commission,
      } = body;
      const now = new Date();
      const asiaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      //추천인 찾기
      const recommender = await this.getRecommender(recommended_code);
      console.log('\x1b[97m\x1b[41m[CRITICAL] recommender:\x1b[0m', recommender);

      //Todo recommender 가 있을시 cash 테이블 신규 생성된 곳에 데이터 저장
      const influence_deposit = wairi_deposit > 0 ? wairi_deposit * 0.3 : 0;
      const dateObj = parseLinkPriceDate(day, time);
      console.log(dateObj.toISOString());

      const tripMemberCashCheck = await queryRunner.manager
        .createQueryBuilder(TripMemberCash, 'tripMemberCash')
        .select('*')
        .where('tripMemberCash.memberId = :affiliate_user_id', { affiliate_user_id })
        .andWhere('tripMemberCash.trlog_id = :trlog_id', { trlog_id })
        .getRawOne();
      console.log('\x1b[97m\x1b[41m[CRITICAL] tripMemberCashCheck222222222:\x1b[0m', tripMemberCashCheck);

      if (tripMemberCashCheck) {
        // ✅ 기존 레코드 업데이트
        await queryRunner.manager.update(
          TripMemberCash, // 1. 엔티티 클래스
          { idx: tripMemberCashCheck.idx }, // 2. 업데이트 대상 조건
          {
            memberId: affiliate_user_id,
            orderid: order_code,
            trlog_id: trlog_id,
            deposit: commisionAmount,
            wairi_deposit: wairi_deposit,
            influence_deposit: influence_deposit,
            total: price,
            withdrawal: 0,
            orderDate: dateObj,
            cancelDate: null,
            created_at: asiaTime.toISOString(),
            title: decodeURIComponent(product_name),
            division: merchant_id,
          }, // 3. 수정할 필드들
        );
      }
      // else {
      //   // ✅ 새 레코드 저장
      //   const tripMemberCash = new TripMemberCash();
      //   tripMemberCash.memberId = affiliate_user_id;
      //   tripMemberCash.orderid = order_code;
      //   tripMemberCash.trlog_id = trlog_id;
      //   tripMemberCash.deposit = commisionAmount;
      //   tripMemberCash.wairi_deposit = wairi_deposit;
      //   tripMemberCash.influence_deposit = influence_deposit;
      //   tripMemberCash.total = price;
      //   tripMemberCash.withdrawal = 0;
      //   tripMemberCash.orderDate = dateObj;
      //   tripMemberCash.cancelDate = null;
      //   tripMemberCash.created_at = asiaTime.toISOString();
      //   tripMemberCash.title = decodeURIComponent(product_name);
      //   tripMemberCash.division = merchant_id;
      //
      //   await queryRunner.manager.save(tripMemberCash);
      // }

      //추천인 커미션 저장
      if (recommender) {
        const exist = await this.recommendMemberCashRepository.findOne({
          where: {
            memberId: affiliate_user_id,
            trlog_id: trlog_id,
          },
        });

        if (!exist) {
          const recommendMemberCash = new RecommendMemberCash();
          recommendMemberCash.memberId = affiliate_user_id;
          recommendMemberCash.recommended_code = recommender?.code ?? null;
          recommendMemberCash.orderid = order_code;
          recommendMemberCash.trlog_id = trlog_id;
          recommendMemberCash.deposit = commisionAmount;
          recommendMemberCash.wairi_deposit = wairi_deposit;
          recommendMemberCash.influence_deposit = influence_deposit;
          recommendMemberCash.total = price;
          recommendMemberCash.withdrawal = 0;
          recommendMemberCash.orderDate = dateObj;
          recommendMemberCash.cancelDate = null;
          recommendMemberCash.created_at = asiaTime.toISOString();
          recommendMemberCash.title = decodeURIComponent(product_name);
          recommendMemberCash.division = merchant_id;

          await queryRunner.manager.save(recommendMemberCash);
        }

        const data = {
          ouid: recommender.id,
          orderid: order_code,
          merchant_id: merchant_id,
          resultKRW: Math.round(influence_deposit),
        };
        //Todo 추천인 적립금 발생 알림
        //merchant_id 로 네임 찾기
        if (recommender.agreeMsg == 1) {
          const merchantName = await this.affiliateRepository
            .createQueryBuilder('affiliate')
            .select('affiliate.name as name')
            .where('merchant_id = :merchant_id', { merchant_id: merchant_id })
            .getRawOne();

          const param = {
            제휴처명: merchantName.name,
            적립금: influence_deposit,
            초대리워드: 'https://pigback-22226.web.app/?target=affiliate&deep_link_sub1=2',
          };
          // this.apiplexService.sendPigUserAlimtalk('zxsca1235gds', recommender.phone, param);
          this.apiplexService.sendPigUserAlimtalk('glhada122jlf', recommender.phone, param);
        }
        //Todo 절약돼지 추천인 push 알림
        this.fcmService.recommenderPush(data);
      }

      return {
        status: 200,
        message: 'Saving Pig recommender commission saved successfully',
        data: {
          recommender,
        },
      };
    } catch (e) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] Error in savingPigRecommenderCommission:\x1b[0m', e);
      throw new HttpException(e.message, e.status);
    }
  }

  //와이리 추천인 커미션 등록
  async wairiRecommenderCommission(body, commisionAmount, wairi_deposit, wairi_member, queryRunner) {
    try {
      const {
        day,
        time,
        merchant_id,
        order_code,
        product_code,
        product_name,
        category_code,
        item_count,
        price,
        commision,
        affiliate_id,
        affiliate_user_id,
        trlog_id,
        base_commission,
        incentive_commission,
      } = body;
      const now = new Date();
      const asiaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const influence_deposit = wairi_deposit > 0 ? wairi_deposit * 0.3 : 0;
      const dateObj = parseLinkPriceDate(day, time);
      console.log(dateObj.toISOString());

      const tripMemberCashCheck = await this.tripMemberCashCheck(affiliate_user_id, trlog_id, '');
      console.log('\x1b[97m\x1b[41m[CRITICAL] tripMemberCashCheck:\x1b[0m', tripMemberCashCheck);

      if (tripMemberCashCheck) {
        // ✅ 기존 레코드 업데이트
        const tripMemberCash = new TripMemberCash();
        tripMemberCash.idx = tripMemberCashCheck.idx; // 기존 레코드의 idx를 사용
        tripMemberCash.memberId = affiliate_user_id;
        tripMemberCash.orderid = order_code;
        tripMemberCash.trlog_id = trlog_id;
        tripMemberCash.deposit = commisionAmount;
        tripMemberCash.wairi_deposit = wairi_deposit;
        tripMemberCash.influence_deposit = influence_deposit;
        tripMemberCash.total = price;
        tripMemberCash.withdrawal = 0; // Assuming withdrawal is 0 for updates
        tripMemberCash.orderDate = dateObj;
        tripMemberCash.cancelDate = null; // Assuming cancelDate is null for updates
        tripMemberCash.created_at = asiaTime.toISOString();
        tripMemberCash.title = decodeURIComponent(product_name);
        tripMemberCash.division = merchant_id;

        await queryRunner.manager.save(tripMemberCash);
      } else {
        // ✅ 새 레코드 저장
        const tripMemberCash = new TripMemberCash();
        tripMemberCash.memberId = affiliate_user_id;
        tripMemberCash.orderid = order_code;
        tripMemberCash.trlog_id = trlog_id;
        tripMemberCash.deposit = commisionAmount;
        tripMemberCash.wairi_deposit = wairi_deposit;
        tripMemberCash.influence_deposit = influence_deposit;
        tripMemberCash.total = price;
        tripMemberCash.withdrawal = 0;
        tripMemberCash.orderDate = dateObj;
        tripMemberCash.cancelDate = null;
        tripMemberCash.created_at = asiaTime.toISOString();
        tripMemberCash.title = decodeURIComponent(product_name);
        tripMemberCash.division = merchant_id;

        await queryRunner.manager.save(tripMemberCash);
      }

      const pigMemberCash = new PigMemberCash();
      pigMemberCash.memberId = wairi_member.id;
      pigMemberCash.orderid = order_code;
      pigMemberCash.recommended_code = wairi_member ? wairi_member.recommended_code : null;
      pigMemberCash.trlog_id = trlog_id;
      pigMemberCash.deposit = commisionAmount;
      pigMemberCash.wairi_deposit = wairi_deposit;
      pigMemberCash.influence_deposit = influence_deposit;
      pigMemberCash.total = price;
      pigMemberCash.withdrawal = 0; // Assuming withdrawal is 0 for new entries
      pigMemberCash.orderDate = dateObj;
      pigMemberCash.cancelDate = null; // Assuming cancelDate is null for new entries
      pigMemberCash.created_at = asiaTime.toISOString();
      pigMemberCash.title = decodeURIComponent(product_name);
      pigMemberCash.division = merchant_id; // Assuming division is '1' for trip
      await this.pigMemberCashRepository.save(pigMemberCash);

      return pigMemberCash;
    } catch (e) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] Error in wairiRecommenderCommission:\x1b[0m', e);
      throw new HttpException(e.message, e.status);
    }
  }
  async getRecommender(recommended_code: string) {
    try {
      return await this.memberRepository
        .createQueryBuilder('member')
        .select('*')
        .where('member.code = :code', { code: recommended_code })
        .getRawOne();
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async pushLinkPriceData(data: any) {
    // FCM 알림 전송
    const member = await this.memberRepository
      .createQueryBuilder('member')
      .select('*')
      .where('member.id = :id', { id: data.ouid })
      .getRawOne();
    // findOne({ where: { id: data.ouid } });
    // console.log('\x1b[97m\x1b[41m[CRITICAL] member:\x1b[0m', member);
    if (member) {
      // const phone = member.phone || '01000000000'; // 전화번호가 없을 경우 기본값 설정
      const phone = '01082308203'; // 전화번호가 없을 경우 기본값 설정

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
          title: '새로운 적립금 발생',
          body: `${affiliate.name}적립금 발생, 금액: ${data.resultKRW} KRW`,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          room: '/AffiliateScreen',
          roomId: data.merchant_id,
          token: tokenList[0].device_token, // 디바이스 토큰
        };
        console.log('\x1b[97m\x1b[41m[CRITICAL] fcmData:\x1b[0m', fcmData);
        await this.fcmService.sendFcmMessage(fcmData);

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
            title: '새로운 적립금 발생',
            body: `${affiliate.name}적립금 발생, 금액: ${data.resultKRW} KRW`,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            room: '/AffiliateScreen',
            roomId: data.merchant_id,
            token: token.device_token, // 각 디바이스 토큰
          };

          await this.fcmService.sendFcmMessage(fcmData);

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

  async getLinkPriceData(params: any) {
    try {
      const a_id = 'A100696547';
      const auth_key = '644493f3858fa9118f76c6417ad45b27';
      let yyyymmdd = params.yyyymmdd;

      if (!yyyymmdd) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        yyyymmdd = `${year}${month}${day}`;
      }

      let page = 1;
      let totalCount = 0;
      let hasMore = true;

      let data = [];
      while (hasMore) {
        const url = `http://api.linkprice.com/affiliate/translist.php?a_id=${a_id}&auth_key=${auth_key}&yyyymmdd=${yyyymmdd}&page=${page}`;
        const response = await axios.get(url);

        console.log('\x1b[97m\x1b[41m[CRITICAL] response.data:\x1b[0m', response.data);

        if (response.data.result !== '0') {
          throw new HttpException(`LinkPrice API error: ${response.data.result}`, 500);
        }

        data = response.data.order_list || [];

        const orderList = response.data.order_list || [];
        const listCount = orderList.length;
        totalCount += listCount;

        for (const item of orderList) {
          const trlog_id = item.trlog_id;

          const statusMap: Record<string, string> = {
            '100': '100',
            '300': '300',
            '310': '900',
            '200': '200',
            '210': '400',
          };

          const commisionAmount = Math.floor(item.commission * 0.8);
          const wairi_deposit = Math.floor(item.commission * 0.2);
          let influence_deposit = 0;

          const member = await this.membershipManagementService.checkWairiRecommended(item.user_id);

          //와이리 추천인 등록 여부 체크
          const wairi_member = await this.membershipManagementService.checkWairiRecommended(item.user_id);

          //절약돼지 추천인 등록 여부 체크
          const purchasing_member = await this.purchasingMemberCheck(item.user_id);

          if (wairi_member && !purchasing_member) {
            influence_deposit = wairi_deposit * 0.3;
          } else if (purchasing_member && !wairi_member) {
            const recommended_code = purchasing_member.refererRootInput;
            const recommender = await this.getRecommender(recommended_code);
            if (recommender) {
              influence_deposit = wairi_deposit * 0.3;
            }
          }

          await this.linkpriceLogRepository.save({
            trlog_id,
            day: item.yyyymmdd,
            time: item.hhmiss,
            status: statusMap[item.status] || '확인요망',
            merchant_id: item.m_id,
            order_code: item.o_cd,
            product_code: item.p_cd,
            product_name: item.p_nm,
            category_code: item.c_cd,
            item_count: Number(item.it_cnt),
            price: Number(item.sales),
            commision: commisionAmount,
            affiliate_id: a_id,
            affiliate_user_id: item.user_id,
            base_commission: item.pur_rate,
            trans_comment: item.trans_comment,
            //trans_comment 값이 있고 item.status = '310' 이면 cancelDate 값 추가
            ...(String(item.status) === '310' && {
              cancelDate: new Date(
                `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
              ),
            }),
            pgm_name: item.pgm_name,
            created_at: new Date().toISOString(),
          });

          //tripMemberCashRepository 에서 trlogId 조회
          const existingTripMemberCash = await this.tripMemberCashRepository
            .createQueryBuilder('tripMemberCash')
            .where('tripMemberCash.trlog_id = :trlogId', { trlogId: trlog_id })
            .getOne();
          console.log('\x1b[97m\x1b[41m[CRITICAL] existingTripMemberCash:\x1b[0m', existingTripMemberCash);
          if (existingTripMemberCash) {
            // 이미 존재하는 경우 업데이트
            console.log('\x1b[97m\x1b[41m[CRITICAL] item.status:\x1b[0m', item.status);
            //deposit , wairi_deposit, influence_deposit 은 String(item.status) === '310' 이면 모두 0 처리
            existingTripMemberCash.deposit = String(item.status) === '310' ? 0 : commisionAmount;
            existingTripMemberCash.wairi_deposit = String(item.status) === '310' ? 0 : wairi_deposit;
            existingTripMemberCash.influence_deposit = String(item.status) === '310' ? 0 : influence_deposit;
            existingTripMemberCash.memberId = item.user_id;
            existingTripMemberCash.division = item.m_id;
            existingTripMemberCash.trlog_id = item.trlog_id;
            existingTripMemberCash.orderid = item.o_cd;
            existingTripMemberCash.total = item.sales;
            existingTripMemberCash.orderDate = new Date(
              `${item.yyyymmdd.slice(0, 4)}-${item.yyyymmdd.slice(4, 6)}-${item.yyyymmdd.slice(6, 8)}T` +
                `${item.hhmiss.slice(0, 2)}:${item.hhmiss.slice(2, 4)}:${item.hhmiss.slice(4, 6)}Z`,
            );
            existingTripMemberCash.created_at = new Date().toISOString();
            existingTripMemberCash.cancelDate =
              String(item.status) === '310'
                ? new Date(
                    `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                  )
                : null; // 310이 아닌 경우 null로 설정
            await this.tripMemberCashRepository.save(existingTripMemberCash);
          } else {
            // 새로운 경우 생성
            const tripMemberCash = new TripMemberCash();
            tripMemberCash.deposit = String(item.status) === '310' ? 0 : commisionAmount;
            tripMemberCash.wairi_deposit = String(item.status) === '310' ? 0 : wairi_deposit;
            tripMemberCash.influence_deposit = String(item.status) === '310' ? 0 : influence_deposit;
            tripMemberCash.memberId = item.user_id;
            tripMemberCash.division = item.m_id;
            tripMemberCash.trlog_id = item.trlog_id;
            tripMemberCash.orderid = item.o_cd;
            tripMemberCash.total = item.sales;
            tripMemberCash.orderDate = new Date(
              `${item.yyyymmdd.slice(0, 4)}-${item.yyyymmdd.slice(4, 6)}-${item.yyyymmdd.slice(6, 8)}T` +
                `${item.hhmiss.slice(0, 2)}:${item.hhmiss.slice(2, 4)}:${item.hhmiss.slice(4, 6)}Z`,
            );
            tripMemberCash.created_at = new Date().toISOString();
            tripMemberCash.cancelDate =
              String(item.status) === '310'
                ? new Date(
                    `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                  )
                : null; // 310이 아닌 경우 null로 설정
            await this.tripMemberCashRepository.save(tripMemberCash);
          }
          //PigMemberCash 업데이트
          console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_member:\x1b[0m', wairi_member);
          if (wairi_member) {
            // 와이리 추천인 커미션 등록
            await this.updatePigMemberCash(
              statusMap,
              commisionAmount,
              wairi_deposit,
              influence_deposit,
              item,
              trlog_id,
            );
            // const pigUpdateQuery = this.pigMemberCashRepository
            //   .createQueryBuilder()
            //   .update(PigMemberCash)
            //   .set({
            //     status: statusMap[item.status] || '확인요망',
            //     deposit: commisionAmount,
            //     wairi_deposit: wairi_deposit,
            //     influence_deposit: influence_deposit,
            //     memberId: item.user_id,
            //     division: item.m_id,
            //     trlog_id: item.trlog_id,
            //     // recommended_code: member ? member.recommended_code : null,
            //     cancelDate:
            //       String(item.status) === '310'
            //         ? new Date(
            //             `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
            //           )
            //         : null, // 310이 아닌 경우 null로 설정
            //     useProcessingDate:
            //       String(item.status) === '210'
            //         ? new Date(
            //             `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
            //           )
            //         : null,
            //   })
            //   .where('trlog_id = :trlogId', { trlogId: trlog_id });
            //
            // await pigUpdateQuery.execute();
          }

          if (purchasing_member && !wairi_member) {
            // 절약돼지 추천인 커미션 등록
            await this.updateRecommenderMemberCash(
              statusMap,
              commisionAmount,
              wairi_deposit,
              influence_deposit,
              item,
              trlog_id,
            );
          }
        }

        if (listCount < 1000) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return {
        status: 'success',
        count: totalCount,
        message: `${yyyymmdd} 기준 데이터 수집 완료`,
        orderList: data,
      };
    } catch (e) {
      console.error(e);
      throw new HttpException(e.message || 'LinkPrice API error', 500);
    }
  }

  //PigMemberCash 업데이트
  async updatePigMemberCash(statusMap, commisionAmount, wairi_deposit, influence_deposit, item, trlog_id) {
    try {
      const pigUpdateQuery = this.pigMemberCashRepository
        .createQueryBuilder()
        .update(PigMemberCash)
        .set({
          status: statusMap[item.status] || '확인요망',
          deposit: commisionAmount,
          wairi_deposit: wairi_deposit,
          influence_deposit: influence_deposit,
          memberId: item.user_id,
          division: item.m_id,
          trlog_id: item.trlog_id,
          // recommended_code: member ? member.recommended_code : null,
          cancelDate:
            String(item.status) === '310'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null, // 310이 아닌 경우 null로 설정
          useProcessingDate:
            String(item.status) === '210'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null,
        })
        .where('trlog_id = :trlogId', { trlogId: trlog_id });

      await pigUpdateQuery.execute();
      return {
        status: 200,
        message: 'PigMemberCash updated successfully',
      };
    } catch (e) {
      console.error(e);
      throw new HttpException(e.message || 'PigMemberCash update error', 500);
    }
  }

  //절약돼지 추천인 커미션 업데이트
  async updateRecommenderMemberCash(statusMap, commisionAmount, wairi_deposit, influence_deposit, item, trlog_id) {
    try {
      const recommenderUpdateQuery = this.recommendMemberCashRepository
        .createQueryBuilder()
        .update(RecommendMemberCash)
        .set({
          status: statusMap[item.status] || '확인요망',
          deposit: commisionAmount,
          wairi_deposit: wairi_deposit,
          influence_deposit: influence_deposit,
          memberId: item.user_id,
          division: item.m_id,
          trlog_id: item.trlog_id,
          cancelDate:
            String(item.status) === '310'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null, // 310이 아닌 경우 null로 설정
          useProcessingDate:
            String(item.status) === '210'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null,
        })
        .where('trlog_id = :trlogId', { trlogId: trlog_id });

      await recommenderUpdateQuery.execute();
      return {
        status: 200,
        message: 'RecommenderMemberCash updated successfully',
      };
    } catch (e) {
      console.error(e);
      throw new HttpException(e.message || 'RecommenderMemberCash update error', 500);
    }
  }

  async testLinkPriceMockData(mockData: any[]) {
    try {
      const a_id = 'A100696547';

      for (const item of mockData) {
        const trlog_id = item.trlog_id;

        const statusMap: Record<string, string> = {
          '100': '100',
          '300': '300',
          '310': '900',
          '200': '200',
          '210': '400',
        };

        const commisionAmount = Math.floor(item.commission * 0.8);
        const member = await this.membershipManagementService.checkWairiRecommended(item.user_id);
        const wairi_deposit = Math.floor(item.commission * 0.2);
        const influence_deposit = member ? wairi_deposit * 0.3 : 0;

        // Save to LinkPriceLog (optional, mock DB)
        await this.linkpriceLogRepository.save({
          trlog_id,
          day: item.yyyymmdd,
          time: item.hhmiss,
          status: statusMap[item.status] || '확인요망',
          merchant_id: item.m_id,
          order_code: item.o_cd,
          product_code: item.p_cd,
          product_name: encodeURIComponent(item.p_nm),
          category_code: item.c_cd,
          item_count: Number(item.it_cnt),
          price: Number(item.sales),
          commision: commisionAmount,
          affiliate_id: a_id,
          affiliate_user_id: item.user_id,
          base_commission: item.pur_rate,
          created_at: new Date().toISOString(),
        });

        // Update TripMemberCash
        await this.tripMemberCashRepository
          .createQueryBuilder()
          .update(TripMemberCash)
          .set({
            deposit: commisionAmount,
            wairi_deposit: wairi_deposit,
            influence_deposit: influence_deposit,
            memberId: item.user_id,
            division: item.m_id,
            trlog_id: item.trlog_id,
            cancelDate:
              String(item.status) === '310'
                ? new Date(
                    `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                  )
                : null, // 310이 아닌 경우 null로 설정
          })
          .where('trlog_id = :trlogId', { trlogId: trlog_id })
          .execute();

        // Update PigMemberCash
        console.log('\x1b[97m\x1b[41m[CRITICAL] member:\x1b[0m', member);
        await this.pigMemberCashRepository
          .createQueryBuilder()
          .update(PigMemberCash)
          .set({
            status: statusMap[item.status] || '확인요망',
            deposit: commisionAmount,
            wairi_deposit: wairi_deposit,
            influence_deposit: influence_deposit,
            // memberId: member.id,
            division: item.m_id,
            trlog_id: item.trlog_id,
            cancelDate:
              String(item.status) === '310'
                ? new Date(
                    `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                  )
                : null, // 310이 아닌 경우 null로 설정
            useProcessingDate:
              String(item.status) === '210'
                ? new Date(
                    `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                  )
                : null,
          })
          .where('trlog_id = :trlogId', { trlogId: trlog_id })
          .execute();
      }

      return {
        status: 'success',
        count: mockData.length,
        message: 'Mock 데이터 처리 완료',
      };
    } catch (e) {
      console.error(e);
      throw new HttpException(e.message || 'Mock 데이터 처리 오류', 500);
    }
  }

  async linkTestData(body: any) {
    try {
      const a_id = 'A100696547';
      for (const item of body) {
        const trlog_id = item.trlog_id;

        // 1. LinkpriceLog 테이블 저장 또는 업데이트

        const statusMap: Record<string, string> = {
          '100': '100',
          '300': '300',
          '310': '900',
          '200': '200',
          '210': '400',
        };
        const commisionAmount = Math.floor(item.commission * 0.8);
        const wairi_deposit = Math.floor(item.commission * 0.2);
        let influence_deposit = 0;

        //와이리 추천인 등록 여부 체크
        const wairi_member = await this.membershipManagementService.checkWairiRecommended(item.user_id);
        console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_member:\x1b[0m', wairi_member);

        //절약돼지 추천인 등록 여부 체크
        const purchasing_member = await this.purchasingMemberCheck(item.user_id);

        if (wairi_member && !purchasing_member) {
          influence_deposit = wairi_deposit * 0.3;
        } else if (purchasing_member && !wairi_member) {
          const recommended_code = purchasing_member.refererRootInput;
          const recommender = await this.getRecommender(recommended_code);
          if (recommender) {
            influence_deposit = wairi_deposit * 0.3;
          }
        }

        await this.linkpriceLogRepository.save({
          trlog_id: trlog_id,
          day: item.yyyymmdd,
          time: item.hhmiss,
          status: statusMap[item.status] || '확인요망',
          merchant_id: item.m_id,
          order_code: item.o_cd,
          product_code: item.p_cd,
          product_name: encodeURIComponent(item.p_nm),
          category_code: item.c_cd,
          item_count: Number(item.it_cnt),
          price: Number(item.sales),
          commision: Number(item.commission),
          affiliate_id: a_id,
          affiliate_user_id: item.user_id,
          base_commission: item.pur_rate, // 필요시 파싱 분리
          trans_comment: item.trans_comment,
          //trans_comment 값이 있고 item.status = '310' 이면 cancelDate 값 추가
          ...(String(item.status) === '310' && {
            cancelDate: new Date(
              `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
            ),
          }),
          created_at: new Date().toISOString(),
        });

        //tripMemberCashRepository 에서 trlogId 조회
        const existingTripMemberCash = await this.tripMemberCashRepository.findOne({
          where: { trlog_id },
        });

        if (existingTripMemberCash) {
          existingTripMemberCash.deposit = commisionAmount;
          existingTripMemberCash.wairi_deposit = wairi_deposit;
          existingTripMemberCash.influence_deposit = influence_deposit;
          existingTripMemberCash.memberId = item.user_id;
          existingTripMemberCash.division = item.m_id;
          existingTripMemberCash.trlog_id = item.trlog_id;
          existingTripMemberCash.orderid = item.o_cd;
          existingTripMemberCash.total = item.sales;
          existingTripMemberCash.orderDate = new Date(
            `${item.yyyymmdd.slice(0, 4)}-${item.yyyymmdd.slice(4, 6)}-${item.yyyymmdd.slice(6, 8)}T` +
              `${item.hhmiss.slice(0, 2)}:${item.hhmiss.slice(2, 4)}:${item.hhmiss.slice(4, 6)}Z`,
          );
          existingTripMemberCash.created_at = new Date().toISOString();
          existingTripMemberCash.cancelDate =
            String(item.status) === '310'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null; // 310이 아닌 경우 null로 설정
          await this.tripMemberCashRepository.save(existingTripMemberCash);
        } else {
          // 새로운 경우 생성
          const tripMemberCash = new TripMemberCash();
          tripMemberCash.deposit = commisionAmount;
          tripMemberCash.wairi_deposit = wairi_deposit;
          tripMemberCash.influence_deposit = influence_deposit;
          tripMemberCash.memberId = item.user_id;
          tripMemberCash.division = item.m_id;
          tripMemberCash.trlog_id = item.trlog_id;
          tripMemberCash.orderid = item.o_cd;
          tripMemberCash.total = item.sales;
          tripMemberCash.orderDate = new Date(
            `${item.yyyymmdd.slice(0, 4)}-${item.yyyymmdd.slice(4, 6)}-${item.yyyymmdd.slice(6, 8)}T` +
              `${item.hhmiss.slice(0, 2)}:${item.hhmiss.slice(2, 4)}:${item.hhmiss.slice(4, 6)}Z`,
          );
          tripMemberCash.created_at = new Date().toISOString();
          tripMemberCash.cancelDate =
            String(item.status) === '310'
              ? new Date(
                  `${item.create_time_stamp.slice(0, 4)}-${item.create_time_stamp.slice(4, 6)}-${item.create_time_stamp.slice(6, 8)}T00:00:00Z`,
                )
              : null; // 310이 아닌 경우 null로 설정
          await this.tripMemberCashRepository.save(tripMemberCash);
        }

        if (wairi_member) {
          console.log('\x1b[97m\x1b[41m[CRITICAL] wairi_member:\x1b[0m', wairi_member);
          // 와이리 추천인 커미션 등록
          await this.updatePigMemberCash(statusMap, commisionAmount, wairi_deposit, influence_deposit, item, trlog_id);
        }

        if (purchasing_member && !wairi_member) {
          // 절약돼지 추천인 커미션 등록
          await this.updateRecommenderMemberCash(
            statusMap,
            commisionAmount,
            wairi_deposit,
            influence_deposit,
            item,
            trlog_id,
          );
        }
      }

      return { status: 'success', count: 1 };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async getLinkPriceList(params: any) {
    try {
      const { page = 1, take = 10 } = params;
      const affiliateQuery = this.affiliateRepository.createQueryBuilder('affiliate');
      affiliateQuery.select([
        'affiliate.idx AS idx',
        'affiliate.name AS name',
        'affiliate.merchant_id AS merchant_id',
        'affiliate.short_description AS short_description',
        'affiliate.landing_url AS landing_url',
        'affiliate.cookie_retention AS cookie_retention',
        'affiliate.commission_rate AS commission_rate',
        'affiliate.reward_timing AS reward_timing',
        'affiliate.withdrawal_timing AS withdrawal_timing',
        'affiliate.notes AS notes',
        'affiliate.has_event AS has_event',
        'affiliate.event_banner_url AS event_banner_url',
        'affiliate.event_banner_key AS event_banner_key',
        'affiliate.event_description AS event_description',
        'affiliate.event_period AS event_period',
        'affiliate.ordering AS ordering',
      ]);
      affiliateQuery.where('affiliate.linkprice = :num', { num: 1 });

      const total = await affiliateQuery.getCount();
      const totalPage = Math.ceil(total / take);
      if (page > totalPage) {
        throw new HttpException('Page not found', 404);
      }
      const data = await affiliateQuery
        .orderBy('affiliate.ordering', 'ASC')
        .offset(take * (page - 1))
        .limit(take)
        .getRawMany();
      const currentPage = page;
      return new Pagination(
        {
          data,
          total,
          totalPage,
          currentPage,
        },
        Number(take),
      );
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  /**
   * 추천인 출금 신청 목록 조회
   * @param params
   */
  async getRecommendWithdrawalApplicationList(params: {
    status: string;
    id: string;
    name: string;
    phone: string;
    email: string;
    dates: string;
    page: number;
    take: number;
  }) {
    try {
      const { status, id, name, email, phone, dates, page, take } = params;
      //console.log('=>(affiliate.service.ts:292) params', params);

      const recommendWithdrawal = this.recommendWithdrawalRepository.createQueryBuilder('recommendWithdrawal');
      recommendWithdrawal.leftJoin('member', 'member', 'member.idx = recommendWithdrawal.memberIdx');
      recommendWithdrawal.select([
        'recommendWithdrawal.idx as idx',
        'recommendWithdrawal.status as status',
        'recommendWithdrawal.memberId as memberId',
        'recommendWithdrawal.memberIdx as memberIdx',
        'recommendWithdrawal.accountNumber as accountNumber',
        'recommendWithdrawal.residentRegistrationNumber as residentRegistrationNumber',
        'recommendWithdrawal.bankName as bankName',
        'recommendWithdrawal.accountHolder as accountHolder',
        'recommendWithdrawal.identificationCardImageKey as identificationCardImageKey',
        'recommendWithdrawal.bankBookImageKey as bankBookImageKey',
        'recommendWithdrawal.denyReason as denyReason',
        'recommendWithdrawal.withdrawalAmount as withdrawalAmount',
        'recommendWithdrawal.created_at as created_at',
        'recommendWithdrawal.phone as phone',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
      ]);
      if (status) {
        // 신청 : 100
        // 완료 : 400
        // 취소 : 900
        // 거절 : -1
        recommendWithdrawal.andWhere('recommendWithdrawal.status = :status', { status });
      }
      if (dates) {
        const date = parseDateRange(dates);
        const startDate = date.startDate;
        const endDate = date.endDate;

        recommendWithdrawal.andWhere('recommendWithdrawal.created_at >= :startDate', { startDate });
        recommendWithdrawal.andWhere('recommendWithdrawal.created_at <= :endDate', { endDate });
      }
      if (id) {
        recommendWithdrawal.andWhere('recommendWithdrawal.memberId LIKE :id', { id: `%${id}%` });
      }
      if (name) {
        recommendWithdrawal.andWhere('member.name LIKE :name', { name: `%${name}%` });
      }
      if (phone) {
        recommendWithdrawal.andWhere('recommendWithdrawal.phone LIKE :phone', { phone: `%${phone}%` });
      }
      if (email) {
        recommendWithdrawal.andWhere('member.email LIKE :email', { email: `%${email}%` });
      }
      if (take) {
        recommendWithdrawal.take(take);
      }
      if (page) {
        recommendWithdrawal.skip((page - 1) * take);
      }
      recommendWithdrawal.orderBy('recommendWithdrawal.idx', 'DESC');

      const data = await recommendWithdrawal
        .offset(take * (page - 1))
        .limit(take)
        .getRawMany();
      const total = await recommendWithdrawal.getCount();

      // const sumQuery = tripWithdrawal.clone(); // 조건이 동일한 쿼리 복제
      // sumQuery.select('SUM(tripWithdrawal.withdrawalAmount)', 'totalWithdrawalAmount');
      // const { totalWithdrawalAmount } = await sumQuery.getRawOne();
      // console.log('=>(affiliate.service.ts:319) totalWithdrawalAmount', totalWithdrawalAmount);

      //data 에서 orderAmount 합계 구하기
      const sumResult = data.reduce((acc, item) => acc + Number(item.withdrawalAmount), 0);
      //console.log(sumResult);
      const totalWithdrawalAmount = Number(sumResult || 0);

      const currentPage = page || 1;

      return {
        ...new Pagination(
          {
            data,
            total,
            currentPage,
          },
          Number(take),
        ),
        totalWithdrawalAmount: Number(totalWithdrawalAmount || 0),
      };
      // return new Pagination(
      //   {
      //     data,
      //     total,
      //     currentPage,
      //   },
      //   Number(take),
      // );
    } catch (e) {
      //console.log('=>(affiliate.service.ts:313) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  /**
   * 추천인 출금 신청 상세 조회
   * @param params
   */
  async getRecommendWithdrawalApplicationDetail(params: { idx: number }) {
    try {
      const { idx } = params;
      const recommendWithdrawal = this.recommendWithdrawalRepository.createQueryBuilder('recommendWithdrawal');
      recommendWithdrawal.leftJoin('member', 'member', 'member.idx = recommendWithdrawal.memberIdx');
      recommendWithdrawal.leftJoin(
        'tripDenyReason',
        'tripDenyReason',
        'tripDenyReason.idx = recommendWithdrawal.denyReason',
      );
      recommendWithdrawal.select([
        'recommendWithdrawal.idx as idx',
        'recommendWithdrawal.status as status',
        'recommendWithdrawal.memberId as memberId',
        'recommendWithdrawal.memberIdx as memberIdx',
        'recommendWithdrawal.accountNumber as accountNumber',
        'recommendWithdrawal.residentRegistrationNumber as residentRegistrationNumber',
        'recommendWithdrawal.bankName as bankName',
        'recommendWithdrawal.accountHolder as accountHolder',
        'recommendWithdrawal.identificationCardImageKey as identificationCardImageKey',
        'recommendWithdrawal.bankBookImageKey as bankBookImageKey',
        // 'recommendWithdrawal.denyReason as denyReason',
        'recommendWithdrawal.withdrawalAmount as withdrawalAmount',
        'recommendWithdrawal.created_at as created_at',
        'recommendWithdrawal.phone as phone',
        'member.name as memberName',
        'member.phone as memberPhone',
        'member.email as memberEmail',
        'tripDenyReason.reason as denyReason',
      ]);
      recommendWithdrawal.andWhere('recommendWithdrawal.idx = :idx', { idx });
      const data = await recommendWithdrawal.getRawOne();
      if (!data) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }
      const domain = 'https://saving-pig.s3.ap-northeast-2.amazonaws.com';
      const { identificationCardImageKey, bankBookImageKey } = data;
      const identificationCardImageUrl = `${domain}/${identificationCardImageKey}`;
      const bankBookImageUrl = `${domain}/${bankBookImageKey}`;
      data.identificationCardImageKey = identificationCardImageUrl;
      data.bankBookImageKey = bankBookImageUrl;
      //console.log('=>(affiliate.service.ts:353) data', data);
      return data;
    } catch (e) {
      console.log('\x1b[97m\x1b[41m[CRITICAL] e:\x1b[0m', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async changeRecommendWithdrawalStatus(params: { idx: number; status: number; denyReason: number }) {
    try {
      //console.log('=>(affiliate.service.ts:364) params', params);
      const idx = params.idx;
      const status = Number(params.status);
      const denyReason = params.denyReason ? params.denyReason : null;
      if (!idx) {
        throw new HttpException('idx 값이 없습니다.', 400);
      }
      const recommendWithdrawal = await this.recommendWithdrawalRepository.findOne({ where: { idx } });
      if (!recommendWithdrawal) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }

      // 상태값 - 100: 신청, 400: 완료, 900: 취소, -1: 거절
      if (status !== 100 && status !== 400 && status !== 900 && status !== -1) {
        throw new HttpException('상태값이 잘못되었습니다.', 400);
      }

      if (status === -1 && !denyReason) {
        throw new HttpException('거절 사유를 입력해주세요.', 400);
      }

      recommendWithdrawal.status = status;
      recommendWithdrawal.denyReason = denyReason;
      recommendWithdrawal.updatedAt = new Date();
      await this.recommendWithdrawalRepository.save(recommendWithdrawal);
    } catch (e) {
      console.log('=>(affiliate.service.ts:changeRecommendWithdrawalStatus) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async deleteRecommendWithdrawal(idx: number) {
    try {
      const recommendWithdrawal = await this.recommendWithdrawalRepository.findOne({
        where: { idx },
      });
      if (!recommendWithdrawal) {
        throw new HttpException('출금 신청 내역이 없습니다.', 404);
      }
      await this.recommendWithdrawalRepository.delete({ idx });
      return {
        status: 200,
        message: '출금 신청 내역 삭제가 완료되었습니다.',
      };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async tripReservationExcel1(res: Response, query: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('트립 예약 내역');

      // 엑셀 헤더 정의
      worksheet.columns = [
        { header: 'No', key: 'no', width: 10 },
        { header: '회원 이름', key: 'memberName', width: 20 },
        { header: '회원 전화번호', key: 'memberPhone', width: 20 },
        { header: '회원 이메일', key: 'memberEmail', width: 30 },
        { header: '주문ID', key: 'orderId', width: 25 },
        { header: '예약자명', key: 'orderName', width: 20 },
        { header: '예약 상태', key: 'statusName', width: 15 },
        { header: '예약 유형', key: 'ordertype', width: 15 },
        { header: '예약금액', key: 'orderAmount', width: 15 },
        { header: '입금금액', key: 'deposit', width: 15 },
        { header: '와이리입금', key: 'wairiDeposit', width: 15 },
        { header: '인플루언서입금', key: 'influenceDeposit', width: 15 },
        { header: '시작일', key: 'startDateTime', width: 25 },
        { header: '종료일', key: 'endDateTime', width: 25 },
        { header: '주문일', key: 'orderDate', width: 25 },
        { header: '등록일', key: 'regDate', width: 25 },
        { header: '푸시일', key: 'pushDate', width: 25 },
        { header: '취소일', key: 'cancelDate', width: 25 },
      ];

      // 헤더 스타일
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFECECEC' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // take/page 제거 후 전체 export 용으로 fetch
      const take = 10000;
      const page = 1;
      // ["2025-07-01", 오늘날짜로] 생성

      // const dates = JSON.stringify(['2025-07-01', new Date().toISOString().split('T')[0]]);
      const result = await this.getTripReservation({ ...query });

      result.data.forEach((item: any, index: number) => {
        worksheet.addRow({
          no: index + 1,
          ...item,
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trip_reservation.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error('엑셀 출력 에러:', e);
      throw new HttpException(e.message, e.status || 500);
    }
  }

  async waugReservationExcel1(res: Response, params: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('와그 예약 내역');

      // 엑셀 헤더 정의
      worksheet.columns = [
        { header: 'No', key: 'no', width: 10 },
        { header: '회원 이름', key: 'memberName', width: 20 },
        { header: '회원 전화번호', key: 'memberPhone', width: 20 },
        { header: '회원 이메일', key: 'memberEmail', width: 30 },
        { header: '예약자명', key: 'orderName', width: 20 },
        { header: '예약 상태', key: 'statusName', width: 15 },
        { header: '예약 유형', key: 'ordertype', width: 15 },
        { header: '예약금액', key: 'orderAmount', width: 15 },
        { header: '입금금액', key: 'deposit', width: 15 },
        { header: '와이리입금', key: 'wairiDeposit', width: 15 },
        { header: '인플루언서입금', key: 'influenceDeposit', width: 15 },
        { header: '시작일', key: 'startDateTime', width: 25 },
        { header: '종료일', key: 'endDateTime', width: 25 },
        { header: '주문일', key: 'orderDate', width: 25 },
        { header: '등록일', key: 'regDate', width: 25 },
      ];

      // 헤더 스타일
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFECECEC' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      // take/page 제거 후 전체 export 용으로 fetch
      const take = 10000;
      const page = 1;
      const result = await this.getWaugReservation({ ...params, take, page });
      result.data.forEach((item: any, index: number) => {
        worksheet.addRow({
          no: index + 1,
          ...item,
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=trip_reservation.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  async agodaReservationExcel1(res: Response, params: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('아고다 예약 내역');

      // 엑셀 헤더 정의
      worksheet.columns = [
        { header: 'No', key: 'no', width: 10 },
        { header: '회원 이름', key: 'memberName', width: 20 },
        { header: '회원 전화번호', key: 'memberPhone', width: 20 },
        { header: '회원 이메일', key: 'memberEmail', width: 30 },
        { header: '예약자명', key: 'orderName', width: 20 },
        { header: '예약 상태', key: 'statusName', width: 15 },
        { header: '예약 유형', key: 'ordertype', width: 15 },
        { header: '예약금액', key: 'orderAmount', width: 15 },
        { header: '입금금액', key: 'deposit', width: 15 },
        { header: '와이리입금', key: 'wairiDeposit', width: 15 },
        { header: '인플루언서입금', key: 'influenceDeposit', width: 15 },
        { header: '시작일', key: 'startDateTime', width: 25 },
        { header: '종료일', key: 'endDateTime', width: 25 },
        { header: '주문일', key: 'orderDate', width: 25 },
        { header: '등록일', key: 'regDate', width: 25 },
      ];

      // 헤더 스타일
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFECECEC' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      // take/page 제거 후 전체 export 용으로 fetch
      const take = 10000;
      const page = 1;
      const result = await this.getAgodaReservation({ ...params, take, page });
      result.data.forEach((item: any, index: number) => {
        worksheet.addRow({
          no: index + 1,
          ...item,
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=agoda_reservation.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  // 기존 각각의 Excel API에서 호출
  async tripReservationExcel(res: Response, query: any) {
    return this.generateReservationExcel(
      res,
      query,
      this.getTripReservation.bind(this),
      '트립 예약 내역',
      'trip_reservation.xlsx',
      'trip',
    );
  }

  async waugReservationExcel(res: Response, query: any) {
    return this.generateReservationExcel(
      res,
      query,
      this.getWaugReservation.bind(this),
      '와그 예약 내역',
      'waug_reservation.xlsx',
      'waug',
    );
  }

  async agodaReservationExcel(res: Response, query: any) {
    return this.generateReservationExcel(
      res,
      query,
      this.getAgodaReservation.bind(this),
      '아고다 예약 내역',
      'agoda_reservation.xlsx',
      'agoda',
    );
  }

  async linkPriceReservationExcel(res: Response, query: any) {
    return this.generateReservationExcel(
      res,
      query,
      this.getLinkPriceReservation.bind(this),
      '링크프라이스 예약 내역',
      'linkprice_reservation.xlsx',
      'linkprice',
    );
  }

  // 공통 엑셀 출력 함수
  private async generateReservationExcel(
    res: Response,
    params: any,
    fetchData: (params: any) => Promise<any>,
    worksheetName: string,
    filename: string,
    division: string,
  ) {
    // 엑셀에서 사용할 상태 매핑
    const TRIP_WAIRI_STATUS_MAP: Record<number, string> = {
      100: '예약',
      200: '승인',
      210: '정산완료',
      300: '취소신청',
      310: '취소완료',
      400: '이용완료',
      900: '취소',
    };

    const TRIP_STATUS_MAP: Record<string, string> = {
      HOTEL_CONFIRMED: '결제완료',
      HOTEL_CANCELLED: '결제취소',
      ACTIVITY_DEALT: '결제완료',
      ACTIVITY_UNSUBSCRIBED: '결제취소',
      FLIGHT_TICKETED: '결제완료',
      FLIGHT_CANCELLED: '결제취소',
      PIAO_COMPLETED: '결제완료',
      PIAO_UNSUBSCRIBED_ALL: '결제취소',
    };

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(worksheetName);
      let columnsConfig: any[] = [];

      switch (division) {
        case 'trip':
          columnsConfig = [
            { header: 'No', key: 'no', width: 10 },
            { header: '종류', key: 'kind', width: 20 },
            { header: '절약돼지상태', key: 'wairiStatusName', width: 20 },
            { header: '트립상태', key: 'tripStatusName', width: 30 },
            { header: '상품명', key: 'orderName', width: 25 },
            { header: '이용기간', key: 'period', width: 20 },
            { header: 'ouid', key: 'ouid', width: 15 },
            { header: '회원명', key: 'memberName', width: 15 },
            { header: '신청일', key: 'orderDate', width: 15 },
            { header: '결제완료일', key: 'pushdate', width: 15 },
            { header: '취소일', key: 'cancelDate', width: 15 },
            { header: '결제금액', key: 'orderAmount', width: 15 },
            { header: '회원수익', key: 'deposit', width: 25 },
            { header: '와이리수익', key: 'wairiDeposit', width: 25 },
            { header: '인플루언서초대수익', key: 'influenceDeposit', width: 25 },
          ];
          break;
        case 'waug':
          columnsConfig = [
            // Define Waug specific columns here
            { header: 'No', key: 'no', width: 10 },
            { header: '종류', key: 'kind', width: 20 },
            { header: '상태', key: 'statusName', width: 10 },
            { header: '상품명', key: 'orderName', width: 20 },
            { header: '사용예정', key: 'expectedUseDate', width: 20 },
            { header: '사용처리일', key: 'useProcessingDate', width: 20 },
            { header: 'ouid', key: 'ouid', width: 20 },
            { header: '결제완료일', key: 'paySuccessDate', width: 20 },
            { header: '취소일', key: 'cancelDate', width: 20 },
            { header: '취소상태', key: 'cancelStatus', width: 20 },
            { header: '취소금액', key: 'cancelAmount', width: 20 },
            { header: '결제금액', key: 'orderAmount', width: 20 },
            { header: '회원수익', key: 'deposit', width: 20 },
            { header: '와이리수익', key: 'wairiDeposit', width: 20 },
            { header: '인플루언서초대수익', key: 'influenceDeposit', width: 20 },
          ];
          break;
        case 'agoda':
          columnsConfig = [
            // Define Waug specific columns here
            { header: 'No', key: 'no', width: 10 },
            { header: '상태', key: 'statusName', width: 20 },
            { header: '예약번호', key: 'orderId', width: 10 },
            { header: '상품명', key: 'orderName', width: 20 },
            { header: 'ouid', key: 'tag', width: 20 },
            { header: '이용기간', key: 'period', width: 20 },
            { header: '예약일', key: 'orderDate', width: 20 },
            { header: '세전예약금액', key: 'orderAmount', width: 20 },
            { header: 'KRW', key: 'krw_amount', width: 20 },
            { header: '회원수익', key: 'deposit', width: 20 },
            { header: '와이리수익', key: 'wairiDeposit', width: 20 },
            { header: '인플루언서초대수익', key: 'influenceDeposit', width: 20 },
          ];
          break;
        case 'linkprice':
          columnsConfig = [
            // Define Waug specific columns here
            { header: 'No', key: 'no', width: 10 },
            { header: '예약일', key: 'reservationDate', width: 20 },
            { header: '제휴사', key: 'merchant_id', width: 20 },
            { header: '상태', key: 'status', width: 20 },
            { header: '예약코드', key: 'orderCode', width: 10 },
            { header: '상품명', key: 'orderName', width: 20 },
            { header: 'ouid', key: 'ouid', width: 20 },
            { header: '회원명', key: 'memberName', width: 20 },
            { header: '취소일', key: 'cancelDate', width: 20 },
            { header: '결제금액', key: 'orderAmount', width: 20 },
            { header: '적립금액', key: 'commision', width: 20 },
            { header: '회원수익', key: 'deposit', width: 20 },
            { header: '와이리수익', key: 'wairiDeposit', width: 20 },
            { header: '인플루언서초대수익', key: 'influenceDeposit', width: 20 },
          ];
          break;
        default:
          throw new BadRequestException(`Invalid division value for Excel generation`);
      }

      // 설정 적용
      worksheet.columns = columnsConfig;

      // 헤더 스타일 적용
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFECECEC' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // const take = 10000;
      // const page = 1;
      const result = await fetchData({ ...params });

      const totalOrderAmount = result.totalOrderAmount;
      const totalDepositAmount = result.totalDepositAmount;
      const totalWairiDepositAmount = result.totalWairiDepositAmount;
      const totalInfluencerDepositAmount = result.totalInfluencerDepositAmount;

      result.data.forEach((raw: any, idx: number) => {
        switch (division) {
          case 'trip': {
            const row = {
              no: idx + 1,
              kind: raw.ordertype,
              wairiStatusName: TRIP_WAIRI_STATUS_MAP[Number(raw.status)] || '', // 내부 status → 한글명
              tripStatusName:
                TRIP_STATUS_MAP[String(raw.orderStatusId)] || TRIP_STATUS_MAP[String(raw.orderstatusid)] || '', // (키 케이스 혼용 대비)
              orderName: raw.orderName ?? raw.ordername ?? '',
              period: [formatToYMD(raw.startDateTime), formatToYMD(raw.endDateTime)].filter(Boolean).join(' ~ '),
              ouid: raw.ouid ?? '',
              memberName: raw.memberName ?? '',
              regDate: raw.regDate ?? '',
              orderDate: raw.orderDate ?? '',
              pushdate: raw.pushdate ?? '',
              cancelDate: raw.cancelDate ?? '',
              orderAmount: Number(raw.orderAmount) ?? 0,
              deposit: raw.deposit ?? 0,
              wairiDeposit: raw.wairiDeposit ?? 0,
              influenceDeposit: raw.influenceDeposit ?? 0,
            };
            worksheet.addRow(row);
            break;
          }
          case 'waug': {
            // 와그 예약 내역 처리
            const waugRow = {
              no: idx + 1,
              kind: raw.orderType || '',
              statusName: raw.status || '',
              orderName: raw.orderName || '',
              expectedUseDate: raw.expectedUseDate || '',
              useProcessingDate: raw.useProcessingDate || '',
              ouid: raw.ouid || '',
              paySuccessDate: raw.paySuccessDate || '',
              cancelDate: raw.refundDate || '',
              cancelStatus: raw.refundStatus || '',
              cancelAmount: raw.refundAmount || 0,
              orderAmount: raw.orderAmount || 0,
              deposit: raw.deposit || 0,
              wairiDeposit: raw.wairiDeposit || 0,
              influenceDeposit: raw.influenceDeposit || 0,
            };
            worksheet.addRow(waugRow);
            break;
          }

          case 'agoda': {
            // 아고다 예약 내역 처리
            const agodaRow = {
              no: idx + 1,
              statusName: raw.reservation_status || '',
              orderId: raw.order_id || '',
              orderName: raw.accommodation_name || '',
              tag: raw.tag || '',
              period: [formatToYMD(raw.checkin_date), formatToYMD(raw.checkout_date)].filter(Boolean).join(' ~ '),
              orderDate: formatToYMD(raw.reservation_date) || '',
              orderAmount: raw.amount_before_tax || 0,
              krw_amount: raw.krw_amount || 0,
              deposit: raw.deposit || 0,
              wairiDeposit: raw.wairiDeposit || 0,
              influenceDeposit: raw.influenceDeposit || 0,
            };
            worksheet.addRow(agodaRow);
            break;
          }

          case 'linkprice': {
            // 링크프라이스 예약 내역 처리
            const linkPriceRow = {
              no: idx + 1,
              reservationDate: raw.full_timestamp || '',
              merchant_id: raw.merchant_id || '',
              affiliateName: raw.affiliate_name || '',
              status: TRIP_WAIRI_STATUS_MAP[Number(raw.status)] || '',
              reservationCode: raw.reservation_code || '',
              orderCode: raw.order_code || '',
              orderName: raw.product_name || '',
              memberName: raw.memberName || '',
              ouid: raw.affiliate_user_id || '',
              cancelDate: raw.cancelDate || '',
              orderAmount: raw.orderAmount || 0,
              commision: raw.deposit || 0,
              deposit: raw.deposit || 0,
              wairiDeposit: raw.wairiDeposit || 0,
              influenceDeposit: raw.influenceDeposit || 0,
            };
            worksheet.addRow(linkPriceRow);
            break;
          }
          default:
            // 다른 division 은 기존 필드 기반으로 그대로 밀어넣기
            worksheet.addRow({ no: idx + 1, ...raw });
            break;
        }
      });

      worksheet.addRow([]); // 빈 줄
      const footerStart = worksheet.addRow(['', '=== 합계(SUMMARY) ===']).number;
      worksheet.getRow(footerStart).font = { bold: true };

      worksheet.addRow(['', '총 결제금액', totalOrderAmount]);
      worksheet.addRow(['', '총 회원수익', totalDepositAmount]);
      worksheet.addRow(['', '총 와이리수익', totalWairiDepositAmount]);
      worksheet.addRow(['', '총 인플루언서초대수익', totalInfluencerDepositAmount]);

      const safe = encodeURIComponent(filename);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${safe}`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error('엑셀 출력 에러:', e);
      throw new HttpException(e.message, e.status || 500);
    }
  }

  async reservationExcel(res: Response, params: any): Promise<any> {
    const { division } = params;

    switch (division) {
      case 'trip':
        return await this.tripReservationExcel(res, params);

      case 'waug':
        return await this.waugReservationExcel(res, params);

      case 'agoda':
        return await this.agodaReservationExcel(res, params);

      case 'linkprice':
        return await this.linkPriceReservationExcel(res, params);

      default:
        throw new BadRequestException(`Invalid division value: ${division}`);
    }
  }
}
