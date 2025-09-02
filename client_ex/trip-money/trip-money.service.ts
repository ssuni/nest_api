import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Trip } from '../../../entity/entities/Trip';
import { Brackets, Repository } from 'typeorm';
import { MembersService } from '../member_model/member.service';
import { bufferToString } from 'src/util/common';
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

@Injectable()
export class TripMoneyService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
    @InjectRepository(TripMemberCash)
    private readonly tripCashRepository: Repository<TripMemberCash>,
    @InjectRepository(TripWithdrawal)
    private readonly tripWithdrawalRepository: Repository<TripWithdrawal>,
    @InjectRepository(TripDenyReason)
    private readonly tripDenyReasonRepository: Repository<TripDenyReason>,
    @InjectRepository(Config)
    private readonly configRepository: Repository<Config>,
    @InjectRepository(Waug)
    private readonly waugRepository: Repository<Waug>,
    @InjectRepository(Agoda)
    private readonly agodaRepository: Repository<Agoda>,
    @InjectRepository(LinkpriceLog)
    private readonly linkpriceLogRepository: Repository<LinkpriceLog>,
    private readonly membersService: MembersService,
    @InjectRepository(RecommendMemberCash)
    private readonly recommendMemberCashRepository: Repository<RecommendMemberCash>,
    @InjectRepository(RecommendWithdrawal)
    private readonly recommendWithdrawalRepository: Repository<RecommendWithdrawal>,
    @InjectRepository(VanillaplantUserProfit)
    private readonly vanillaplantUserProfitRepository: Repository<VanillaplantUserProfit>,
  ) {}

  // 예약 현황(param 값에 따라 기간, 상태별로 조회)
  async findTripLinks(
    authUser: any,
    status?: number | null,
    startDate?: string | null,
    endDate?: string | null,
    division?: string | 'trip',
  ): Promise<any[]> {
    console.log('=>(trip-money.service.ts:41) status', status);
    console.log('=>(trip-money.service.ts:41) startDate', startDate);
    console.log('=>(trip-money.service.ts:41) endDate', endDate);
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const ouid = member.id;

      let data = [];

      switch (division) {
        case 'trip':
          data = await this.findTripLinksTrip(ouid, status, startDate, endDate);
          return data;
        case 'waug':
          data = await this.findTripLinksWaug(ouid, status, startDate, endDate);
          data.forEach((element) => {
            // waug_status : 사용(400), 미사용(100) waug_refundStatus 전체환불 900
            if (element.waug_status == '사용') {
              element.status = 400;
            } else if (element.waug_status == '미사용') {
              element.status = 100;
            }
            if (element.waug_refundStatus == '전체환불') {
              element.status = 900;
            }
            if (element.waug_refundStatus == '부분환불') {
              element.status = 800;
            }
          });
          console.log('=>(trip-money.service.ts:112) data', data);
          return data;
        case 'agoda':
          data = await this.findTripLinksAgoda(ouid, status, startDate, endDate);
          // console.log('\x1b[97m\x1b[41m[CRITICAL] data:\x1b[0m', data);

          data.forEach((element) => {
            console.log('[DEBUG] agoda_reservation_status:', element.agoda_reservation_status);
            const checkoutDate = new Date(element.agoda_checkout_date);
            // checkoutDate.setMonth(checkoutDate.getMonth() + 1);
            checkoutDate.setDate(checkoutDate.getDate() + 1);

            // checkoutDate + 1일
            const checkoutPlusOne = new Date(checkoutDate);
            checkoutPlusOne.setDate(checkoutPlusOne.getDate() + 1);

            const targetStatuses = ['Fully Booked', 'Confirmed', 'Departed', 'Charged'];
            // 오늘 날짜 (현재 시각)
            const now = new Date();
            //agoda_reservation_status == "Charged" && agoda_checkout_date + 1 month <= now  상태 '400'
            // if (element.agoda_reservation_status == 'Charged' && checkoutDate <= new Date()) {
            if (
              element.agoda_reservation_status == 'Charged' &&
              new Date(checkoutDate).setDate(new Date(checkoutDate).getDate() + 1) <= new Date().getTime()
            ) {
              element.status = 400;
            } else if (
              element.agoda_reservation_status === 'Departed' &&
              new Date(checkoutDate).setDate(new Date(checkoutDate).getDate() + 1) <= new Date().getTime()
            ) {
              // checkin_date 현재 보다 미래일때 상태 '100'
              element.status = 400;
            } else if (element.agoda_reservation_status == 'Charged' && element.agoda_checkin_date > new Date()) {
              // checkin_date 현재 보다 미래일때 상태 '100'
              element.status = 100;
            } else if (element.agoda_reservation_status.toLowerCase().includes('cancelled')) {
              //reservation_status 에 Cancelled 란 글짜가 포함되어있다면 상태 '900'
              element.status = 900;
            } else {
              element.status = 100;
            }

            if (targetStatuses.includes(element.agoda_reservation_status) && checkoutPlusOne <= now) {
              element.status = 400;
            }
          });
          return data;
        default:
          data = await this.findTripLinksLinkPrice(ouid, status, startDate, endDate, division);
          return data;
      }
    } catch (error) {
      console.error('Error fetching trip links:', error);
    }
  }

  private async findTripLinksTrip(
    ouid: any,
    status?: number | null,
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<any[]> {
    const queryBuilder = this.tripRepository.createQueryBuilder('trip');
    queryBuilder
      .leftJoinAndSelect(
        'TripMemberCash',
        'tripMemberCash',
        'tripMemberCash.orderid = trip.orderid AND tripMemberCash.memberId = trip.ouid',
      )
      .select(['trip', 'tripMemberCash.total', 'tripMemberCash.deposit'])
      .where('trip.ouid = :ouid', { ouid })
      .andWhere('trip.orderdate >= 1722438000'); // 2024-08-01

    // 상태 조건
    if (status !== undefined && status !== null) {
      queryBuilder.andWhere('trip.status = :status', { status });
    }
    // 날짜 범위 조건 (timestamp값으로 변환 후 비교연산 처리)
    if (startDate !== undefined && startDate !== null && endDate !== undefined && endDate !== null) {
      const startTimestamp = this.stringToTimestamp(startDate) / 1000;
      const endTimestamp = this.stringToTimestamp(endDate, true) / 1000;

      queryBuilder.andWhere('trip.orderdate >= :startTimestamp AND trip.orderdate < :endTimestamp', {
        startTimestamp,
        endTimestamp,
      });
    }
    queryBuilder.orderBy('trip.orderdate', 'DESC');

    return await queryBuilder.getRawMany();
  }

  private async findTripLinksAgoda(
    ouid: any,
    status?: number | null,
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<any[]> {
    const queryBuilder = this.agodaRepository.createQueryBuilder('agoda');
    queryBuilder
      .leftJoinAndSelect(
        'TripMemberCash',
        'tripMemberCash',
        'tripMemberCash.orderid = agoda.order_id AND tripMemberCash.memberId = agoda.tag',
      )
      .select(['agoda', 'tripMemberCash.total', 'tripMemberCash.deposit'])
      .where('agoda.tag = :tag', { tag: ouid });

    // 상태 조건
    if (status !== undefined && status !== null) {
      if (status == 400) {
        //reservation_status == "Charged" && agoda.checkout_date + 1 month <= now
        queryBuilder.andWhere(
          // new Brackets((qb) => {
          //   qb.where('agoda.reservation_status = "Charged" AND NOW() >= DATE_ADD(agoda.regdate, INTERVAL 1 MONTH)');
          // }),
          new Brackets((qb) => {
            // qb.where(
            //   '(agoda.reservation_status = "Charged" OR agoda.reservation_status = "Departed") AND NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)',
            // );
            qb.where(
              `UPPER(agoda.reservation_status) IN (:...statuses)
       AND NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)`,
              { statuses: ['FULLY BOOKED', 'CONFIRMED', 'DEPARTED', 'CHARGED'] },
            );
          }),
        );
      } else if (status == 100) {
        queryBuilder.andWhere('agoda.reservation_status = "Charged"');
        // checkin_date 현재 보다 미래일때
        queryBuilder.andWhere('agoda.checkin_date > NOW()');
      } else if (status == 900) {
        //reservation_status 에 Cancelled 란 글짜가 포함되어있다면
        queryBuilder.andWhere('agoda.reservation_status LIKE :status', { status: '%Cancelled%' });
      }
    }
    // 날짜 범위 조건 (timestamp값으로 변환 후 비교연산 처리)
    if (startDate !== undefined && startDate !== null && endDate !== undefined && endDate !== null) {
      const startTimestamp = this.stringToTimestamp(startDate) / 1000;
      const endTimestamp = this.stringToTimestamp(endDate, true) / 1000;

      queryBuilder.andWhere('agoda.reseration_data >= :startTimestamp AND agoda.reseration_data < :endTimestamp', {
        startTimestamp,
        endTimestamp,
      });
    }
    queryBuilder.orderBy('agoda.regdate', 'DESC');

    const result = await queryBuilder.getRawMany();
    // console.log('\x1b[97m\x1b[41m[CRITICAL] result:\x1b[0m', result);
    return result;
  }

  private async findTripLinksWaug(
    ouid: any,
    status?: number | null,
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<any[]> {
    const queryBuilder = this.waugRepository.createQueryBuilder('waug');
    queryBuilder
      .leftJoinAndSelect(
        'TripMemberCash',
        'tripMemberCash',
        'tripMemberCash.orderid = waug.orderId AND tripMemberCash.memberId = waug.ouid',
      )
      .select(['waug', 'tripMemberCash.total', 'tripMemberCash.deposit'])
      .where('waug.ouid = :ouid', { ouid })
      .andWhere('waug.regdate >= 1722438000'); // 2024-08-01
    console.log('=>(trip-money.service.ts:80) status', status);
    // 상태 조건
    if (status !== undefined && status !== null) {
      if (status == 400) {
        queryBuilder.andWhere('waug.status = "사용"');
      } else if (status == 100) {
        queryBuilder.andWhere('waug.status = "미사용"');
        queryBuilder.andWhere('waug.refundStatus != "전체환불"');
      } else if (status == 900) {
        queryBuilder.andWhere('waug.refundStatus = "전체환불"');
      } else if (status == 800) {
        queryBuilder.andWhere('waug.refundStatus = "부분환불"');
      }
    }
    // 날짜 범위 조건 (timestamp값으로 변환 후 비교연산 처리)
    if (startDate !== undefined && startDate !== null && endDate !== undefined && endDate !== null) {
      const startTimestamp = this.stringToTimestamp(startDate) / 1000;
      const endTimestamp = this.stringToTimestamp(endDate, true) / 1000;

      queryBuilder.andWhere('waug.expectedUseDate >= :startTimestamp AND waug.expectedUseDate <= :endTimestamp', {
        startTimestamp: startDate,
        endTimestamp: endDate,
      });
      // queryBuilder.orWhere('waug.refundDate >= :startTimestamp AND waug.refundDate < :endTimestamp', {
      //   startTimestamp,
      //   endTimestamp,
      // });
    }
    queryBuilder.orderBy('waug.useProcessingDate', 'DESC');
    //add order by waug.refundDate desc

    return await queryBuilder.getRawMany();
  }

  private async findTripLinksLinkPrice(
    ouid: any,
    status?: number | null,
    startDate?: string | null,
    endDate?: string | null,
    division?: string | 'agoda',
  ): Promise<any[]> {
    const queryBuilder = this.linkpriceLogRepository.createQueryBuilder('linkpriceLog');
    queryBuilder
      .leftJoin('TripMemberCash', 'tripMemberCash', 'tripMemberCash.trlog_id = linkpriceLog.trlog_id')
      .select(['linkpriceLog.*'])
      .addSelect('tripMemberCash.total', 'total')
      .addSelect('tripMemberCash.deposit', 'deposit')
      .where('linkpriceLog.affiliate_user_id = :ouid', { ouid })
      .andWhere('linkpriceLog.merchant_id = :merchantId', { merchantId: division })
      .andWhere('linkpriceLog.created_at >= 1722438000'); // 2024-08-01

    // 상태 조건
    if (status !== undefined && status !== null) {
      if (status == 400) {
        queryBuilder.andWhere('linkpriceLog.status = :status', { status: '210' });
      } else if (status == 100) {
        queryBuilder.andWhere('linkpriceLog.status = :status', { status: '100' });
      } else if (status == 900) {
        queryBuilder.andWhere('linkpriceLog.status = :status', { status: '310' });
      }
    }
    // 날짜 범위 조건 (timestamp값으로 변환 후 비교연산 처리)
    if (startDate !== undefined && startDate !== null && endDate !== undefined && endDate !== null) {
      const startDay = startDate.replace(/-/g, ''); // "20250323"
      const endDay = endDate.replace(/-/g, ''); // "20250430"
      //linkpriceLog.day linkpriceLog.time 값을 합쳐서 날짜를 비교해야 하므로
      //linkpriceLog.day는 YYYYMMDD 형식, linkpriceLog.time은 HHMMSS 형식
      queryBuilder.andWhere('linkpriceLog.day >= :startDay', { startDay });
      queryBuilder.andWhere('linkpriceLog.day <= :endDay', { endDay });
    }
    queryBuilder.orderBy('linkpriceLog.created_at', 'DESC');

    return await queryBuilder.getRawMany();
  }

  // 출금 신청 상태 & 거절 메세지
  async showWithdrawalStatus(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;

      const { firstDay, lastDay } = this.getCurrentMonth();
      // console.log('날짜들 : ',firstDay,lastDay); //"2024-09-01T00:00:00.000Z","2024-09-30T23:59:59.999Z"

      const queryBuilder = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      queryBuilder
        .leftJoin('TripDenyReason', 'tripDenyReason', 'tripDenyReason.idx = tripWithdrawal.denyReason')
        .select('tripWithdrawal.memberId', 'memberId')
        .addSelect('tripWithdrawal.status', 'status')
        .addSelect('tripWithdrawal.denyReason', 'reasonIdx')
        .addSelect('tripDenyReason.reason', 'denyReason')
        .where('tripWithdrawal.memberId = :memberId', { memberId })
        .andWhere('tripWithdrawal.created_at >= :firstDay', { firstDay }) // 이번달에 출금신청한 데이터만
        .andWhere('tripWithdrawal.created_at <= :lastDay', { lastDay })
        .orderBy('tripWithdrawal.created_at', 'DESC'); // 가장 최근 데이터 하나만 출력되게

      const result = await queryBuilder.getRawOne();
      console.log('result:', result);
      return bufferToString(result);
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to showWithdrawalStatus');
    }
  }

  async showLastWithdrawal(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const { firstDay, lastDay } = this.getCurrentMonth();

      const queryBuilder = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      queryBuilder
        .select('tripWithdrawal.*')
        .where('tripWithdrawal.memberId = :memberId', { memberId })
        .andWhere('tripWithdrawal.created_at >= :firstDay', { firstDay }) // 이번달에 출금신청한 데이터만
        .andWhere('tripWithdrawal.created_at <= :lastDay', { lastDay })
        .orderBy('tripWithdrawal.idx', 'DESC')
        .limit(1);

      const result = await queryBuilder.getRawOne();
      return bufferToString(result);
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to showLastWithdrawal');
    }
  }

  // 출금 가능 금액
  async showWithdrawable(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const resultTrip = await this.showWithdrawableTrip(memberId, startDate);
      //와그 데이터
      const resultWaug = await this.showWithdrawableWaug(memberId, startDate);

      //아고다 데이터
      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere(
          // new Brackets((qb) => {
          //   qb.where('agoda.reservation_status = "Charged" AND NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)');
          // }),
          new Brackets((qb) => {
            // qb.where(
            //   '(agoda.reservation_status = "Charged" OR agoda.reservation_status = "Departed") AND NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)',
            // );
            qb.where(
              `UPPER(agoda.reservation_status) IN (:...statuses)
       AND NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)`,
              { statuses: ['FULLY BOOKED', 'CONFIRMED', 'DEPARTED', 'CHARGED'] },
            );
          }),
        )
        .groupBy('tripCash.memberId'); // 그룹화 추가
      const resultAgoda = (await queryBuilderAgoda.getRawOne()) || { withdrawable: 0 };
      console.log('=>(trip-money.service.ts: 아고다 출금 가능 금액) resultAgoda', resultAgoda);

      //링크 프라이스 데이터
      const resultLinkPrice = await this.showWithdrawableLinkPrice(memberId, startDate, 'agoda');

      // 트립 & 와그 데이터 합치기
      console.log('=>(trip-money.service.ts:205) 출금 가능 금액: ', resultTrip, resultWaug, resultLinkPrice);

      // //tripWithdrawal에 있는 출금신청 금액 빼기
      // const queryBuilderWithdrawal = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      // queryBuilderWithdrawal
      //   .select('tripWithdrawal.memberId', 'memberId')
      //   .addSelect('COALESCE(SUM(tripWithdrawal.withdrawalAmount), 0)', 'withdrawable') // null값 0으로 처리
      //   .where('tripWithdrawal.memberId = :memberId', { memberId })
      //   .andWhere('tripWithdrawal.created_at >= :startDate', { startDate })
      //   // status 100,400인 경우만 Todo 100 처리 확인
      //   .andWhere('tripWithdrawal.status IN (400)');
      // const resultWithdrawal = await queryBuilderWithdrawal.getRawOne();
      // bufferToString(resultWithdrawal);
      // console.log('=>(trip-money.service.ts: 출금신청 금액) resultWithdrawal', resultWithdrawal);

      // return {
      //   memberId: resultTrip.memberId,
      //   withdrawable: Number(resultTrip.withdrawable) + Number(resultWaug.withdrawable) - Number(resultWithdrawal.withdrawable),
      // };
      return {
        memberId: resultTrip.memberId,
        withdrawable:
          Number(resultTrip.withdrawable) +
          Number(resultWaug.withdrawable) +
          Number(resultAgoda.withdrawable) +
          Number(resultLinkPrice.withdrawable),
        // Number(resultWithdrawal.withdrawable),
      };
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }

  async showWithdrawableTrip(memberId, startDate) {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin('Trip', 'trip', 'trip.orderid = tripCash.orderid AND trip.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.cancelDate IS NULL') // cancelDate가 NULL인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere('NOW() >= DATE_ADD(FROM_UNIXTIME(trip.enddatetime), INTERVAL 1 DAY)'); // 사용완료 한달 후
    //        .andWhere('NOW() >= FROM_UNIXTIME(trip.enddatetime)'); // 오늘보다큰
    const resultTrip = await queryBuilderTrip.getRawOne();
    bufferToString(resultTrip);
    console.log('=>(trip-money.service.ts: 트립 출금 가능 금액) :', resultTrip);
    return resultTrip;
  }

  async showWithdrawableWaug(memberId, startDate) {
    const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderWaug
      .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      // .andWhere('tripCash.cancelDate IS NULL') // cancelDate가 NULL인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere(
        new Brackets((qb) => {
          qb.where('waug.status = "사용" AND NOW() >= DATE_ADD(waug.expectedUseDate, INTERVAL 1 DAY)').orWhere(
            'waug.refundStatus = "부분환불" AND NOW() >= DATE_ADD(waug.expectedUseDate, INTERVAL 1 DAY)',
          );
        }),
      )
      .groupBy('tripCash.memberId'); // 그룹화 추가
    const resultWaug = (await queryBuilderWaug.getRawOne()) || { withdrawable: 0 };
    // return resultWaug.withdrawable;
    bufferToString(resultWaug);
    console.log('=>(trip-money.service.ts: 와그 출금 가능 금액) resultWaug', resultWaug);
    return resultWaug;
  }

  async showWithdrawableLinkPrice(memberId, startDate, division: string) {
    const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderAgoda
      .leftJoin(
        'linkprice_log',
        'linkprice_log',
        'linkprice_log.trlog_id = tripCash.trlog_id AND linkprice_log.affiliate_user_id = tripCash.memberId',
      )
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('linkprice_log.status = :status', { status: '400' }) // Charged 상태
      //create at 1일 지난것만
      .andWhere('NOW() >= DATE_ADD(linkprice_log.created_at, INTERVAL 1 DAY)')
      .groupBy('tripCash.memberId'); // 그룹화 추가
    const result = (await queryBuilderAgoda.getRawOne()) || { withdrawable: 0 };
    console.log('=>(trip-money.service.ts: 링크프라이스 출금 가능 금액) result', result);
    return result;
  }

  // 총 결제 금액
  async showTotalDeposit(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const resultTrip = await this.showTripTotalDeposit(memberId, startDate);

      //와그 데이터
      const resultWaug = await this.showWaugTotalDeposit(memberId, startDate);

      //아고다 데이터
      const resultAgoda = await this.showAgodaTotalDeposit(memberId, startDate);

      //아고다 데이터
      const resultLinkPrice = await this.showLinkPriceTotalDeposit(memberId, startDate, 'agoda');

      // 트립 & 와그 데이터 합치기
      console.log('=>(trip-money.service.ts:205) 트립 토탈 결제 금액: ', resultTrip);
      console.log('=>(trip-money.service.ts:205) 와그 토탈 결제 금액: ', resultWaug);
      console.log('=>(trip-money.service.ts:205) 아고다 토탈 결제 금액: ', resultAgoda);
      console.log('=>(trip-money.service.ts:205) 링크 프라이스 토탈 결제 금액: ', resultLinkPrice);
      return {
        memberId: memberId,
        totalDeposit:
          Number(resultTrip.totalDeposit) +
          Number(resultWaug.totalDeposit) +
          Number(resultAgoda.totalDeposit) +
          Number(resultLinkPrice.totalDeposit),
      };
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to showTotalDeposit');
    }
  }

  //트립 총 결제금액
  private async showTripTotalDeposit(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripRepository.createQueryBuilder('trip');
    queryBuilderTrip
      .select('*')
      // .addSelect('COALESCE(SUM(trip.orderamount), 0)', 'totalDeposit') // null값 0으로 처리
      .where('trip.ouid = :memberId', { memberId })
      .andWhere('trip.regdate >= :startDate', { startDate });
    const resultTrip = await queryBuilderTrip.getRawMany();
    bufferToString(resultTrip);
    const result = await this.getExchangeRate(resultTrip, 'trip');

    return result;
  }

  //와그 총 결제금액
  private async showWaugTotalDeposit(memberId: any, startDate: any): Promise<any> {
    const queryBuilderWaug = this.waugRepository.createQueryBuilder('waug');
    // queryBuilderWaug
    //   .select('*')
    //   // .addSelect('COALESCE(SUM(waug.orderAmount), 0)', 'totalDeposit') // null값 0으로 처리
    //   .where('waug.ouid = :memberId', { memberId })
    //   .andWhere('waug.regdate >= :startDate', { startDate });
    // const resultWaug = await queryBuilderWaug.getRawMany();
    queryBuilderWaug
      .select([
        'waug.orderAmount AS orderAmount',
        'waug.refundStatus AS refundStatus',
        'waug.refundAmount AS refundAmount',
        'waug.currency AS currency',
      ])
      .where('waug.ouid = :memberId', { memberId })
      .andWhere('waug.regdate >= :startDate', { startDate });

    const resultWaug = await queryBuilderWaug.getRawMany();

    // refund 적용해서 orderAmount 수정
    resultWaug.forEach((row) => {
      const orderAmount = Number(row.orderAmount) || 0;
      const refundAmount = Number(row.refundAmount) || 0;
      if (row.refundStatus && refundAmount > 0) {
        row.orderAmount = orderAmount - refundAmount; // 환불 차감 반영
      } else {
        row.orderAmount = orderAmount; // 그대로 사용
      }
    });
    bufferToString(resultWaug);
    const result = await this.getExchangeRate(resultWaug, 'waug');
    return result;
  }

  //아고다 총 결제금액
  private async showAgodaTotalDeposit(memberId: any, startDate: any): Promise<any> {
    const queryBuilderAgoda = this.agodaRepository.createQueryBuilder('agoda');
    queryBuilderAgoda
      .select('*')
      .where('agoda.tag = :memberId', { memberId })
      .andWhere('agoda.regdate >= :startDate', { startDate });
    const resultAgoda = await queryBuilderAgoda.getRawMany();
    bufferToString(resultAgoda);
    const result = await this.getExchangeRate(resultAgoda, 'agoda');
    return result;
  }

  //링크프라이스 총 결제금액
  private async showLinkPriceTotalDeposit(memberId: any, startDate: any, division: string): Promise<any> {
    // const queryBuilder = this.linkpriceLogRepository.createQueryBuilder('linkpriceLog');
    // queryBuilder.select('*').where('linkpriceLog.affiliate_user_id = :memberId', { memberId });
    const queryBuilder = this.linkpriceLogRepository.createQueryBuilder('linkpriceLog');
    queryBuilder
      .select('*')
      .where('linkpriceLog.affiliate_user_id = :memberId', { memberId })
      .andWhere('linkpriceLog.deleted_at IS NULL');
    // .andWhere('linkpriceLog.merchant_id = :merchantId', { merchantId: division });
    const result = await queryBuilder.getRawMany();
    const totalDeposit = result.reduce((sum, element) => sum + Number(element.price || 0), 0);
    console.log('\x1b[97m\x1b[41m[CRITICAL] showLinkPriceTotalDeposit:\x1b[0m', totalDeposit);
    return {
      totalDeposit: totalDeposit || 0, // null값 0으로 처리
    };
  }

  // 국가별 환율 계산
  private async getExchangeRate(data: any, type: string) {
    try {
      const exchangeRate = await this.configRepository
        .createQueryBuilder('config')
        .select('cfg_value')
        .where(
          new Brackets((qb) => {
            qb.where('config.cfg_key = :usdRate', { usdRate: 'Exchange_rate' }).orWhere('config.cfg_key = :cnyRate', {
              cnyRate: 'Exchange_rate_cny',
            });
          }),
        )
        .getRawMany();
      // 환율 적용
      // 환율 매핑
      const exchangeRates = {
        USD: Number(exchangeRate[0].cfg_value),
        CNY: Number(exchangeRate[1].cfg_value),
        KRW: 1,
      };

      let totalDeposit = 0;

      data.forEach((element) => {
        //trip = orderamount, waug = orderAmount, agoda = amount_before_tax
        let rawDeposit: number;

        switch (type) {
          case 'trip':
            rawDeposit = Number(element.orderamount);
            break;
          case 'waug':
            rawDeposit = Number(element.orderAmount);
            break;
          case 'agoda':
            rawDeposit = Number(element.krw_amount);
            // element.currency = element.currency || 'USD'; // 기본값 설정
            // console.log(element.price);
            break;
          default:
            console.warn(`[getExchangeRate] Unsupported type: ${type}`);
            return;
        }

        if (element.currency) {
          const rate = exchangeRates[element.currency];
          console.log('\x1b[97m\x1b[41m[CRITICAL] rate:\x1b[0m', rate);
          if (isNaN(rawDeposit) || rate === undefined) {
            // console.warn(`Invalid deposit or exchange rate for element:`, element);
            return;
          }

          const convertedDeposit = type == 'trip' ? rawDeposit : rawDeposit * rate;
          element.totalDeposit = convertedDeposit;

          // 누적합 계산
          totalDeposit += convertedDeposit;
        } else {
          element.totalDeposit = rawDeposit; // 환율이 없을 경우 원화로 처리
          totalDeposit += rawDeposit; // 누적합 계산
        }

        // if (isNaN(rawDeposit) || rate === undefined) {
        //   // console.warn(`Invalid deposit or exchange rate for element:`, element);
        //   return;
        // }
        //
        // const convertedDeposit = rawDeposit * rate;
        // element.totalDeposit = convertedDeposit;
        //
        // // 누적합 계산
        // totalDeposit += convertedDeposit;
      });
      console.log(`\x1b[97m\x1b[41m[CRITICAL] ${type}:\x1b[0m`, `총 환산 금액 (totaltotalDeposit): ${totalDeposit}`);
      return {
        totalDeposit: Math.round(totalDeposit),
      };
    } catch (e) {
      console.error('Error fetching exchange rate:', e);
      throw new Error('Failed to fetch exchange rate');
    }
  }

  // 환불 금액
  async showTotalCancel(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const resultTrip = await this.showTripTotalCancel(memberId, startDate);

      //와그 데이터
      const resultWaug = await this.showWaugTotalCancel(memberId, startDate);

      //아고다 데이터
      const resultAgoda = await this.showAgodaTotalCancel(memberId, startDate);

      //링크 프라이스 데이터
      const resultLinkPrice = await this.showTotalCancelLinkPrice(memberId, startDate);
      // 트립 & 와그 데이터 합치기
      console.log(
        '=>(trip-money.service.ts:205) 토탈 취소 금액: ',
        resultTrip,
        resultWaug,
        resultAgoda,
        resultLinkPrice,
      );
      return {
        memberId: resultTrip.memberId,
        totalDeposit:
          Number(resultTrip.totalDeposit) +
          Number(resultWaug.totalDeposit) +
          Number(resultAgoda.totalDeposit) +
          Number(resultLinkPrice.totalDeposit),
      };
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money - showTotalCancel');
    }
  }

  //트립 총 취소금액
  private async showTripTotalCancel(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripRepository.createQueryBuilder('trip');
    queryBuilderTrip
      .select('*')
      .where('trip.ouid = :memberId', { memberId })
      .andWhere('trip.cancel > 0')
      .andWhere('trip.regdate >= :startDate', { startDate });
    const resultTrip = await queryBuilderTrip.getRawMany();
    bufferToString(resultTrip);
    const result = await this.getExchangeRate(resultTrip, 'trip');
    return result;
  }

  //와그 총 취소금액
  private async showWaugTotalCancel(memberId: any, startDate: any): Promise<any> {
    const queryBuilderWaug = this.waugRepository.createQueryBuilder('waug');
    queryBuilderWaug
      .select('*')
      .where('waug.ouid = :memberId', { memberId })
      .andWhere('waug.refundAmount > 0')
      .andWhere('waug.regdate >= :startDate', { startDate });
    const resultWaug = await queryBuilderWaug.getRawMany();
    bufferToString(resultWaug);
    const result = await this.getExchangeRate(resultWaug, 'waug');
    return result;
  }

  //아고다 총 취소금액
  private async showAgodaTotalCancel(memberId: any, startDate: any): Promise<any> {
    const queryBuilderAgoda = this.agodaRepository.createQueryBuilder('agoda');
    queryBuilderAgoda
      .select('*')
      .where('agoda.tag = :memberId', { memberId })
      .andWhere('agoda.reservation_status LIKE :reservationStatus', {
        reservationStatus: '%Cancelled%',
      })
      .andWhere('agoda.regdate >= :startDate', { startDate });
    const resultAgoda = await queryBuilderAgoda.getRawMany();
    const result = await this.getExchangeRate(resultAgoda, 'agoda');
    return result;
  }

  private async showTotalCancelLinkPrice(memberId: any, startDate: any) {
    const queryBuilderLinkPrice = this.linkpriceLogRepository.createQueryBuilder('linkpriceLog');
    queryBuilderLinkPrice
      .select('*')
      .where('linkpriceLog.affiliate_user_id = :memberId', { memberId })
      .andWhere('linkpriceLog.status = :status', { status: '310' }) // Cancelled 상태
      .andWhere('linkpriceLog.created_at >= :startDate', { startDate });
    const result = await queryBuilderLinkPrice.getRawMany();
    const totalDeposit = result.reduce((sum, element) => sum + Number(element.price || 0), 0);

    return {
      totalDeposit: totalDeposit || 0, // null값 0으로 처리
    };
  }

  // 수익 누적 금액
  async showTotalProfit(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const resultTrip = await this.showTotalProfitTrip(memberId, startDate);
      console.log('=>(trip-money.service.ts:showTotalProfitTrip 트립 토탈 수익 누적 금액): ', resultTrip);
      //와그 데이터
      const resultWaug = await this.showTotalProfitDivision(memberId, startDate, 'waug');
      console.log('=>(trip-money.service.ts: 와그 토탈 수익 누적 금액): ', resultWaug);

      //아고다 데이터
      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.division = :division', { division: 'agoda' }) // division이 agoda인 경우
        .andWhere('tripCash.created_at >= :startDate', { startDate });
      //        .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
      const resultAgoda = await this.showTotalProfitAgoda(memberId, startDate);
      console.log('=>(trip-money.service.ts: 아고다 토탈 수익 누적 금액): ', resultAgoda);

      //링크프라이스 데이터
      const resultLinkPrice = await this.showTotalProfitLinkPrice(memberId, startDate);
      console.log('=>(trip-money.service.ts 848: 링크프라이스 토탈 수익 누적 금액): ', resultLinkPrice);

      // 트립 & 와그 데이터 합치기
      console.log(
        '=>(trip-money.service.ts:205) 토탈 수익 누적 금액: ',
        resultTrip,
        resultWaug,
        resultAgoda,
        resultLinkPrice,
      );
      return {
        memberId: resultTrip.memberId,
        totalDeposit:
          Number(resultTrip.totalDeposit) +
          Number(resultWaug.totalDeposit) +
          Number(resultAgoda.totalDeposit) +
          Number(resultLinkPrice.totalDeposit),
      };
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }

  private showTotalProfitDivision(memberId: any, startDate: any, division: string): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.division = :division', { division: division })
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
    return queryBuilderTrip.getRawOne();
  }

  private showTotalProfitTrip(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin('Trip', 'trip', 'trip.orderid = tripCash.orderid AND trip.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.division = :division', { division: 'trip' }) // division이 1(트립)인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      // .andWhere('NOW() >= DATE_ADD(FROM_UNIXTIME(trip.enddatetime), INTERVAL 1 DAY)') // 사용완료 다음날 이후
      .andWhere('trip.status = :status', { status: 400 }) // 사용완료 상태
      .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
    return queryBuilderTrip.getRawOne();
  }

  private showTotalProfitWaug(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.division = :division', { division: 'waug' }) // division이 2(와그)인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere(
        new Brackets((qb) => {
          qb.where('waug.status = "사용" AND NOW() >= DATE_ADD(waug.expectedUseDate, INTERVAL 1 DAY)').orWhere(
            'waug.refundStatus = "부분환불" AND NOW() >= DATE_ADD(waug.expectedUseDate, INTERVAL 1 DAY)',
          );
        }),
      )
      .andWhere('tripCash.cancelDate IS NULL') // cancelDate가 NULL인 경우
      .groupBy('tripCash.memberId'); // 그룹화 추가
    return queryBuilderTrip.getRawOne();
  }

  private showTotalProfitAgoda(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.division = :division', { division: 'agoda' }) // division이 agoda인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere('NOW() >= DATE_ADD(agoda.checkout_date, INTERVAL 1 DAY)') // 체크아웃 다음날 이후
      .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
    return queryBuilderTrip.getRawOne();
  }

  private showTotalProfitLinkPrice(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin(
        'linkprice_log',
        'linkpriceLog',
        'linkpriceLog.trlog_id = tripCash.trlog_id AND linkpriceLog.affiliate_user_id = tripCash.memberId',
      )
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      //trip waug 제외
      .andWhere('tripCash.division NOT IN ("trip", "waug","agoda")') // division이 1(트립) 또는 2(와그)가 아닌 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere('linkpriceLog.status = :status', { status: '400' }) // Charged 상태
      .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
    return queryBuilderTrip.getRawOne();
  }

  // 플랫폼별 수익 누적금액
  async showTotalProfitByPlatform(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderTrip
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.division = 1')
        .andWhere('tripCash.created_at >= :startDate', { startDate });
      //        .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
      const resultTrip = await queryBuilderTrip.getRawOne();
      console.log('=>(trip-money.service.ts: 트립 토탈 수익 누적 금액): ', resultTrip);

      //와그 데이터
      const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderWaug
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.division = 2')
        .andWhere('tripCash.created_at >= :startDate', { startDate });
      //        .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
      const resultWaug = await queryBuilderWaug.getRawOne();
      console.log('=>(trip-money.service.ts: 와그 토탈 수익 누적 금액): ', resultWaug);

      //아고다 데이터
      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'totalDeposit') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.division = 3')
        .andWhere('tripCash.created_at >= :startDate', { startDate });
      //        .andWhere('tripCash.cancelDate IS NULL'); // cancelDate가 NULL인 경우
      const resultAgoda = await queryBuilderAgoda.getRawOne();
      console.log('=>(trip-money.service.ts: 아고다 토탈 수익 누적 금액): ', resultAgoda);
    } catch (e) {
      console.error('Error fetching amount of money:', e);
      throw new Error('Failed to fetch amount of money - showTotalProfitByPlatform');
    }
  }

  //출금(수익) 확정 금액
  async showConfirmedWithdrawal(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      // 트립 데이터
      const resultTrip = (await this.showConfirmedWithdrawalTrip(memberId, startDate)) || { withdrawable: 0 };
      console.log('=>(trip-money.service.ts: 출금(수익) 확정 금액) resultTrip', resultTrip);
      // 와그 데이터
      const resultWaug = (await this.showConfirmedWithdrawalWaug(memberId, startDate)) || { withdrawable: 0 };
      console.log('=>(trip-money.service.ts: 출금(수익) 확정 금액) resultWaug', resultWaug);

      //아고다 데이터
      const resultAgoda = (await this.showConfirmedWithdrawalLinkPrice(memberId, 'agoda')) || { withdrawable: 0 };
      // const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      // queryBuilderAgoda
      //   .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
      //   .select('tripCash.memberId', 'memberId')
      //   .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      //   .where('tripCash.memberId = :memberId', { memberId })
      //   .andWhere('tripCash.created_at >= :startDate', { startDate })
      //   //agoda.checkout_date 현재보다 크거나 같은 경우
      //   .andWhere(
      //     new Brackets((qb) => {
      //       qb.where('agoda.reservation_status != "Cancelled By Customer" AND NOW() >= agoda.checkout_date ');
      //     }),
      //   )
      //   .groupBy('tripCash.memberId'); // 그룹화 추가
      // const resultAgoda = (await queryBuilderAgoda.getRawOne()) || { withdrawable: 0 };

      // 트립 & 와그 데이터 합치기
      console.log('=>(trip-money.service.ts:205) 출금(수익) 확정 금액: ', resultTrip, resultWaug, resultAgoda);
      return {
        memberId: resultTrip.memberId,
        withdrawable:
          Number(resultTrip.withdrawable) + Number(resultWaug.withdrawable) + Number(resultAgoda.withdrawable),
      };
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }

  private showConfirmedWithdrawalTrip(memberId: any, startDate: any): Promise<any> {
    const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderTrip
      .leftJoin('Trip', 'trip', 'trip.orderid = tripCash.orderid AND trip.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.cancelDate is null') // cancelDate가 NULL인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere('trip.status = 400'); // 이용완료
    //          .andWhere('NOW() >= DATE_ADD(FROM_UNIXTIME(trip.enddatetime), INTERVAL 1 MONTH)'); // 사용완료 한달 후
    //        .andWhere('NOW() >= FROM_UNIXTIME(trip.enddatetime)'); // 오늘보다큰
    return queryBuilderTrip.getRawOne();
  }

  private showConfirmedWithdrawalWaug(memberId: any, startDate: any): Promise<any> {
    const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilderWaug
      .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      // .andWhere('tripCash.cancelDate IS NULL') // cancelDate가 NULL인 경우
      .andWhere('tripCash.created_at >= :startDate', { startDate })
      .andWhere(
        new Brackets((qb) => {
          qb.where('waug.status = "사용"').orWhere('waug.refundStatus = "부분환불" AND NOW() > waug.expectedUseDate');
        }),
      )
      .groupBy('tripCash.memberId'); // 그룹화 추가
    return queryBuilderWaug.getRawOne();
  }

  private showConfirmedWithdrawalLinkPrice(memberId: any, division: any): Promise<any> {
    const queryBuilder = this.tripCashRepository.createQueryBuilder('tripCash');
    queryBuilder
      .leftJoin(
        'linkprice_log',
        'linkPriceLog',
        'linkPriceLog.order_code = tripCash.orderid AND linkPriceLog.affiliate_user_id = tripCash.memberId',
      )
      .select('tripCash.memberId', 'memberId')
      .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
      .where('tripCash.memberId = :memberId', { memberId })
      .andWhere('tripCash.division = :division', { division })
      .andWhere('tripCash.created_at >= :startDate', { startDate: new Date('2024-08-01') })
      .andWhere('linkPriceLog.status = :status', { status: '정산완료' })
      // .andWhere(
      //   new Brackets((qb) => {
      //     qb.where(
      //       'linkPriceLog.status = "Charged" AND NOW() >= DATE_ADD(linkPriceLog.checkout_date, INTERVAL 1 MONTH)',
      //     );
      //   }),
      // )
      .groupBy('tripCash.memberId'); // 그룹화 추가
    return queryBuilder.getRawOne();
  }

  //수익예정금액
  async showExpectedProfitAmount(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      //트립 데이터
      const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderTrip
        .leftJoin('Trip', 'trip', 'trip.orderid = tripCash.orderid AND trip.ouid = tripCash.memberId')
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.cancelDate is null') // cancelDate가 NULL인 경우
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere('trip.status = 100'); // 이용완료
      const resultTrip = await queryBuilderTrip.getRawOne();

      const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderWaug
        .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        // .andWhere('tripCash.cancelDate IS NULL') // cancelDate가 NULL인 경우
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere(
          new Brackets((qb) => {
            qb.where('waug.status = "미사용" AND NOW() < waug.expectedUseDate').orWhere(
              'waug.refundStatus = "부분환불" AND NOW() < waug.expectedUseDate',
            );
          }),
        )
        .groupBy('tripCash.memberId'); // 그룹화 추가

      const resultWaug = (await queryBuilderWaug.getRawOne()) || { withdrawable: 0 };

      //아고다 데이터
      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
        .select('tripCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripCash.deposit), 0)', 'withdrawable') // null값 0으로 처리
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere(
          new Brackets((qb) => {
            qb.where('agoda.reservation_status != "Cancelled By Customer" AND NOW() < agoda.checkout_date ');
          }),
        )
        .groupBy('tripCash.memberId'); // 그룹화 추가
      const resultAgoda = (await queryBuilderAgoda.getRawOne()) || { withdrawable: 0 };

      // 트립 & 와그 데이터 합치기
      // console.log('=>(trip-money.service.ts:205) 수익예정금액: ', resultTrip, resultWaug, resultAgoda);
      return {
        memberId: resultTrip.memberId,
        withdrawable: Number(resultTrip.withdrawable) + Number(resultWaug.withdrawable),
      };
    } catch (e) {
      console.log('=>(trip-money.service.ts:274) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  // 출금 누적 금액
  async showTotalWithdrawal(authUser: any): Promise<any> {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;

      const queryBuilder = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      queryBuilder
        .select('tripWithdrawal.memberId', 'memberId')
        .addSelect('COALESCE(SUM(tripWithdrawal.withdrawalAmount), 0)', 'totalWithdrawal')
        .where('tripWithdrawal.memberId = :memberId', { memberId })
        .andWhere('tripWithdrawal.status = 400'); // 승인완료(400)

      const result = await queryBuilder.getRawOne();

      return bufferToString(result);
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }

  async showProfitTotal(authUser: any) {
    try {
      // const offset = (page - 1) * limit;
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
      // Trip에 있는 ordername 가져오기
      queryBuilderTrip
        .leftJoinAndSelect('Trip', 'trip', 'trip.orderid = tripCash.orderid')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'trip.ordername as orderName',
          'trip.orderdate as orderDate',
          'trip.startdatetime as startdatetime',
          'trip.enddatetime as enddatetime',
          'trip.status as status',
          'trip.idx as idx',
          'trip.orderamount as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        //        .andWhere('NOW() >= FROM_UNIXTIME(trip.enddatetime)') // 이용완료 이후
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('tripCash.division = "trip"')
        .orderBy('tripCash.orderDate', 'DESC');
      // .limit(limit)
      // .offset(offset);
      const profitLists = await queryBuilderTrip.getRawMany();
      bufferToString(profitLists);
      console.log('=>(trip-money.service.ts: showProfit Trip) Trip', profitLists);

      const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderWaug
        .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'waug.orderName as orderName',
          'waug.expectedUseDate as enddatetime',
          'waug.paySuccessDate as orderDate',
          'waug.expectedUseDate as startdatetime',
          'waug.status as status',
          'waug.idx as idx',
          'waug.orderAmount as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        // .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('waug.refundStatus <> "전체환불"')
        // .andWhere('waug.status <> "미사용"')
        //waug.expectedUseDate 오늘 이전 날짜
        .andWhere('waug.expectedUseDate < CURRENT_DATE()') // ✅ 오늘 이전 날짜 조건 추가
        .andWhere('tripCash.division = "waug"')
        .orderBy('tripCash.orderDate', 'DESC');
      // .limit(limit)
      // .offset(offset);
      const profitLists2 = await queryBuilderWaug.getRawMany();
      console.log('profitLists2====' + profitLists2);
      bufferToString(profitLists2);
      //orderDate , startdatetime, enddatetime 을 unixtime으로 변환
      profitLists2.forEach((item) => {
        item.orderDate = new Date(item.orderDate).getTime() / 1000;
        item.startdatetime = new Date(item.startdatetime).getTime() / 1000;
        item.enddatetime = new Date(item.enddatetime).getTime() / 1000;
        item.status = item.status === '사용' ? 400 : 200;
      });

      console.log('=>(trip-money.service.ts: showProfit Waug) Waug', profitLists2);

      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'agoda.idx as idx',
          'agoda.accommodation_name as orderName',
          'agoda.checkout_date as enddatetime',
          'agoda.payment_date as orderDate',
          'agoda.checkin_date as startdatetime',
          'agoda.reservation_status as status',
          'agoda.amount_before_tax as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('tripCash.division = "agoda"')
        .orderBy('tripCash.orderDate', 'DESC');
      // .limit(limit)
      // .offset(offset);
      const profitLists3 = await queryBuilderAgoda.getRawMany();
      bufferToString(profitLists3);

      const queryBuilderLinkPrice = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderLinkPrice
        .leftJoin(
          'linkprice_log',
          'linkPriceLog',
          'linkPriceLog.order_code = tripCash.orderid AND linkPriceLog.affiliate_user_id = tripCash.memberId',
        )
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'linkPriceLog.product_name as orderName',
          'linkPriceLog.created_at as enddatetime',
          'linkPriceLog.created_at as orderDate',
          'linkPriceLog.created_at as startdatetime',
          'linkPriceLog.status as status',
          'linkPriceLog.price as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('linkPriceLog.status != :status', { status: 900 })
        // .andWhere('tripCash.division = "linkprice"')
        .orderBy('tripCash.orderDate', 'DESC');
      // .limit(limit)
      // .offset(offset);

      const profitLists4 = await queryBuilderLinkPrice.getRawMany();
      bufferToString(profitLists4);

      console.log('=>(trip-money.service.ts: showProfit linkPriceLog) linkPriceLog', profitLists4);

      const combinedData = [...profitLists, ...profitLists2, ...profitLists3, ...profitLists4].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      //combinedData deposit 총합
      const totalDeposit = combinedData.reduce((acc, curr) => acc + Number(curr.deposit || 0), 0);
      console.log('=>(trip-money.service.ts:518) combinedData', combinedData);

      return totalDeposit;
    } catch (error) {
      console.error('Error fetching cash lists:', error);
      throw new Error('Failed to fetch cash lists');
    }
  }
  // 수익
  async showProfit(authUser: any, page = 1, limit = 10): Promise<any[]> {
    try {
      const offset = (page - 1) * limit;
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const startDate = new Date('2024-08-01');

      const queryBuilderTrip = this.tripCashRepository.createQueryBuilder('tripCash');
      // Trip에 있는 ordername 가져오기
      queryBuilderTrip
        .leftJoinAndSelect('Trip', 'trip', 'trip.orderid = tripCash.orderid')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'trip.ordername as orderName',
          'trip.orderdate as orderDate',
          'trip.startdatetime as startdatetime',
          'trip.enddatetime as enddatetime',
          'trip.status as status',
          'trip.idx as idx',
          'trip.orderamount as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        //        .andWhere('NOW() >= FROM_UNIXTIME(trip.enddatetime)') // 이용완료 이후
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('tripCash.division = "trip"')
        .orderBy('tripCash.orderDate', 'DESC')
        .limit(limit)
        .offset(offset);
      const profitLists = await queryBuilderTrip.getRawMany();
      bufferToString(profitLists);
      console.log('=>(trip-money.service.ts: showProfit Trip) Trip', profitLists);

      const queryBuilderWaug = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderWaug
        .leftJoin('Waug', 'waug', 'waug.orderId = tripCash.orderid AND waug.ouid = tripCash.memberId')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'waug.orderName as orderName',
          'waug.expectedUseDate as enddatetime',
          'waug.paySuccessDate as orderDate',
          'waug.expectedUseDate as startdatetime',
          'waug.status as status',
          'waug.idx as idx',
          'waug.orderAmount as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        // .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('waug.refundStatus <> "전체환불"')
        // .andWhere('waug.status <> "미사용"')
        //waug.expectedUseDate 오늘 이전 날짜
        .andWhere('waug.expectedUseDate < CURRENT_DATE()') // ✅ 오늘 이전 날짜 조건 추가
        .andWhere('tripCash.division = "waug"')
        .orderBy('tripCash.orderDate', 'DESC')
        .limit(limit)
        .offset(offset);
      const profitLists2 = await queryBuilderWaug.getRawMany();
      console.log('profitLists2====' + profitLists2);
      bufferToString(profitLists2);
      //orderDate , startdatetime, enddatetime 을 unixtime으로 변환
      profitLists2.forEach((item) => {
        item.orderDate = new Date(item.orderDate).getTime() / 1000;
        item.startdatetime = new Date(item.startdatetime).getTime() / 1000;
        item.enddatetime = new Date(item.enddatetime).getTime() / 1000;
        item.status = item.status === '사용' ? 400 : 200;
      });

      console.log('=>(trip-money.service.ts: showProfit Waug) Waug', profitLists2);

      const queryBuilderAgoda = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderAgoda
        .leftJoin('Agoda', 'agoda', 'agoda.order_id = tripCash.orderid AND agoda.tag = tripCash.memberId')
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'agoda.idx as idx',
          'agoda.accommodation_name as orderName',
          'agoda.checkout_date as enddatetime',
          'agoda.payment_date as orderDate',
          'agoda.checkin_date as startdatetime',
          'agoda.reservation_status as status',
          'agoda.amount_before_tax as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('tripCash.division = "agoda"')
        .orderBy('tripCash.orderDate', 'DESC')
        .limit(limit)
        .offset(offset);
      const profitLists3 = await queryBuilderAgoda.getRawMany();
      bufferToString(profitLists3);

      const queryBuilderLinkPrice = this.tripCashRepository.createQueryBuilder('tripCash');
      queryBuilderLinkPrice
        .leftJoin(
          'linkprice_log',
          'linkPriceLog',
          'linkPriceLog.order_code = tripCash.orderid AND linkPriceLog.affiliate_user_id = tripCash.memberId',
        )
        .select([
          'tripCash.memberId as memberId',
          'tripCash.created_at as created_at',
          'tripCash.deposit as deposit',
          'tripCash.total as total',
          'tripCash.division as division',
          'linkPriceLog.product_name as orderName',
          'linkPriceLog.created_at as enddatetime',
          'linkPriceLog.created_at as orderDate',
          'linkPriceLog.created_at as startdatetime',
          'linkPriceLog.status as status',
          'linkPriceLog.price as orderamount',
        ])
        .where('tripCash.memberId = :memberId', { memberId })
        .andWhere('tripCash.created_at >= :startDate', { startDate })
        .andWhere('tripCash.cancelDate IS NULL')
        .andWhere('linkPriceLog.status != :status', { status: 900 })
        // .andWhere('tripCash.division = "linkprice"')
        .orderBy('tripCash.orderDate', 'DESC')
        .limit(limit)
        .offset(offset);

      const profitLists4 = await queryBuilderLinkPrice.getRawMany();
      bufferToString(profitLists4);

      console.log('=>(trip-money.service.ts: showProfit linkPriceLog) linkPriceLog', profitLists4);

      const combinedData = [...profitLists, ...profitLists2, ...profitLists3, ...profitLists4].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      console.log('=>(trip-money.service.ts:518) combinedData', combinedData);

      return combinedData;
    } catch (error) {
      console.error('Error fetching cash lists:', error);
      throw new Error('Failed to fetch cash lists');
    }
  }

  // 출금
  async showWithdrawal(authUser: any): Promise<TripWithdrawal[]> {
    try {
      const memberIdx = authUser.idx;
      const { firstDay, lastDay } = this.getCurrentMonth();
      const currentDate = new Date();
      const startDate = new Date('2024-08-01');

      const queryBuilder = this.tripWithdrawalRepository.createQueryBuilder('tripWithdrawal');
      // 현재 날짜가 이번 달 26일 이후인지 확인
      //      if (currentDate.getDate() >= 26) {
      //        // 이번 달의 데이터도 포함
      //        queryBuilder
      //          .where('tripWithdrawal.memberIdx = :memberIdx', { memberIdx })
      //      } else {
      //        // 이전 달의 데이터만 조회
      //        queryBuilder
      //          .where('tripWithdrawal.memberIdx = :memberIdx', { memberIdx })
      //          .andWhere('tripWithdrawal.created_at >= :startDate', { startDate })
      //          .andWhere('tripWithdrawal.created_at < :firstDayOfMonth', { firstDayOfMonth: firstDay });
      //      }
      queryBuilder
        .where('tripWithdrawal.memberIdx = :memberIdx', { memberIdx })
        .andWhere('tripWithdrawal.status = 400'); // 승인완료
      queryBuilder.orderBy('tripWithdrawal.created_at', 'DESC');

      const withdrawalLists = await queryBuilder.getMany();
      return bufferToString(withdrawalLists);
    } catch (error) {
      console.error('Error fetching withdrawal lists:', error);
      throw new Error('Failed to fetch withdrawal lists');
    }
  }

  private stringToTimestamp(dateString: string, isEndDate = false): number {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // 마지막 날짜 선택시 다음날 자정 기준으로 변환
    if (isEndDate) {
      date.setDate(date.getDate() + 1);
    }
    return date.getTime();
  }

  private getCurrentMonth(): { firstDay: Date; lastDay: Date } {
    const currentDate = new Date();
    const firstDayOfMonth = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), 1));
    const lastDayOfMonth = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + 1, 1) - 1);
    return { firstDay: firstDayOfMonth, lastDay: lastDayOfMonth };
  }

  async getIntroductionImg() {
    try {
      const config = await this.configRepository
        .createQueryBuilder('config')
        .select('config.cfgValue', 'img')
        .where('config.cfgKey = :cfgKey', { cfgKey: 'Introduction_money' })
        .getRawMany();
      bufferToString(config);
      return config;
    } catch (e) {
      console.log('=>(trip-money.service.ts:301) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async showRecommendWithdrawable(authUser: any) {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      console.log('\x1b[97m\x1b[41m[CRITICAL] member:\x1b[0m', member);
      const memberCode = member.code;
      const startDate = new Date('2024-08-01');
      const queryBuilder = this.recommendMemberCashRepository.createQueryBuilder('recommendMemberCash');
      queryBuilder
        .select('recommendMemberCash.memberId', 'memberId')
        .addSelect('COALESCE(SUM(recommendMemberCash.influence_deposit), 0)', 'withdrawable') // null값 0으로 처리
        .where('recommendMemberCash.recommended_code = :code', { code: memberCode })
        //status = '400'
        .andWhere('recommendMemberCash.status = :status', { status: '400' }) // 승인완료
        .groupBy('recommendMemberCash.memberId'); // ← 이 줄 추가
      const result = await queryBuilder.getRawOne();
      bufferToString(result);

      if (!result) {
        return {
          memberId: member.id, // 또는 memberCode, 실제 기대값에 따라
          withdrawable: 0,
        };
      }

      return {
        memberId: result.memberId,
        withdrawable: Number(result.withdrawable),
      };
    } catch (e) {
      console.log('=>(trip-money.service.ts: showPigWithdrawable) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async showLastRecommendWithdrawal(authUser: any) {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;
      const { firstDay, lastDay } = this.getCurrentMonth();

      const queryBuilder = this.recommendWithdrawalRepository.createQueryBuilder('recommendWithdrawal');
      queryBuilder
        .select('recommendWithdrawal.*')
        .where('recommendWithdrawal.memberId = :memberId', { memberId })
        .andWhere('recommendWithdrawal.created_at >= :firstDay', { firstDay }) // 이번달에 출금신청한 데이터만
        .andWhere('recommendWithdrawal.created_at <= :lastDay', { lastDay })
        .orderBy('recommendWithdrawal.idx', 'DESC')
        .limit(1);

      const result = await queryBuilder.getRawOne();
      return bufferToString(result);
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }

  async showRecommendWithdrawalStatus(authUser: any) {
    try {
      const member = await this.membersService.findByIdx(authUser.idx);
      const memberId = member.id;

      const { firstDay, lastDay } = this.getCurrentMonth();
      // console.log('날짜들 : ',firstDay,lastDay); //"2024-09-01T00:00:00.000Z","2024-09-30T23:59:59.999Z"

      const queryBuilder = this.recommendWithdrawalRepository.createQueryBuilder('recommendWithdrawal');
      queryBuilder
        .leftJoin('TripDenyReason', 'tripDenyReason', 'tripDenyReason.idx = recommendWithdrawal.denyReason')
        .select('recommendWithdrawal.memberId', 'memberId')
        .addSelect('recommendWithdrawal.status', 'pigstatus')
        .addSelect('recommendWithdrawal.denyReason', 'pigreasonIdx')
        .addSelect('tripDenyReason.reason', 'pigdenyReason')
        .where('recommendWithdrawal.memberId = :memberId', { memberId })
        .andWhere('recommendWithdrawal.created_at >= :firstDay', { firstDay }) // 이번달에 출금신청한 데이터만
        .andWhere('recommendWithdrawal.created_at <= :lastDay', { lastDay })
        .orderBy('recommendWithdrawal.created_at', 'DESC'); // 가장 최근 데이터 하나만 출력되게

      const result = await queryBuilder.getRawOne();
      return bufferToString(result);
    } catch (error) {
      console.error('Error fetching amount of money:', error);
      throw new Error('Failed to fetch amount of money');
    }
  }
}
