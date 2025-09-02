import { Args, Query, Resolver } from '@nestjs/graphql';
import { TripMoneyService } from './trip-money.service';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/auth/GqlAuthGuard';
import { Member } from 'entity/entities/Member';
import { AuthUser } from 'src/auth/auth-user.decorator';
import { FROM_UNIXTIME_JS_YY_MM_DD } from '../../util/common';

@Resolver('TripMoney')
export class TripMoneyResolver {
  constructor(private readonly tripMoneyService: TripMoneyService) {}

  @Query('getIntroductionImg')
  async getIntroductionImg() {
    const data = await this.tripMoneyService.getIntroductionImg();
    const imgs = data.map((item) => ({ url: item.img }));

    return {
      img: imgs,
    };
  }

  /**
   * 내 숏링크로 생성된 트립 링크 조회
   * @param authUser 액세스 토큰
   * @param status 예약 상태 (100 : 예약, 400 : 완료, 900 : 취소)
   * @param startDate 처음 날짜
   * @param endDate 마지막 날짜
   * @param division
   * @returns 트립 링크들
   */
  @Query('tripMoneyLink')
  @UseGuards(GqlAuthGuard)
  async findTripLinks(
    @AuthUser() authUser: Member,
    @Args('status', { nullable: true }) status?: number,
    @Args('start', { nullable: true }) startDate?: string,
    @Args('end', { nullable: true }) endDate?: string,
    @Args('division', { nullable: true }) division?: string,
  ) {
    try {
      division ??= 'trip';
      const tripLinks = await this.tripMoneyService.findTripLinks(authUser, status, startDate, endDate, division);
      // console.log('=>(trip-money.resolver.ts:43) tripLinks', tripLinks);
      const safeLinks = Array.isArray(tripLinks) ? tripLinks : []; //
      if (!tripLinks || tripLinks.length === 0) {
        console.warn('🛑 No trip links found.');
        return []; // ✅ 빈 배열 반환
      }
      switch (division) {
        case 'trip':
          return {
            tripLinks: tripLinks.map((link) => ({
              ...link,
              ordername: link.trip_ordername,
              ordertype: link.trip_ordertype,
              orderDate: this.formatDate(link.trip_orderdate),
              startDate: this.formatDateL(link.trip_startdatetime),
              endDate: this.formatDateL(link.trip_enddatetime),
              status: link.trip_status,
              total: link.tripMemberCash_total, // 결제금액
              deposit: link.tripMemberCash_deposit, // 수익금액
            })),
          };
        case 'waug':
          console.log('=>(trip-money.resolver.ts:65) tripLinks', tripLinks);
          return {
            tripLinks: tripLinks.map((link) => ({
              ...link,
              ordername: link.waug_orderName,
              ordertype: link.waug_orderType,
              orderDate: link.waug_paySuccessDate ? link.waug_paySuccessDate.toISOString() : '', // Date → String 변환
              //서울 시간 +9시간
              startDate: link.waug_expectedUseDate
                ? new Date(link.waug_expectedUseDate.getTime() + 9 * 60 * 60 * 1000).toISOString()
                : '',
              endDate: link.waug_expectedUseDate
                ? new Date(link.waug_expectedUseDate.getTime() + 9 * 60 * 60 * 1000).toISOString()
                : '',
              status: link.status,
              total: link.tripMemberCash_total, // 결제금액
              deposit: link.tripMemberCash_deposit, // 수익금액
            })),
          };
        case 'agoda':
          const statusMap = {
            100: 100,
            900: 900,
            // 필요한 상태값들 매핑
          };

          return {
            tripLinks: tripLinks.map((link) => ({
              ...link,
              ordername: link.agoda_accommodation_name,
              ordertype: link.agoda_dmc,
              orderDate: link.agoda_reservation_date
                ? new Date(link.agoda_reservation_date.getTime() + 9 * 60 * 60 * 1000).toISOString()
                : '', // Date → String 변환
              //서울 시간 +9시간
              startDate: link.agoda_checkin_date
                ? new Date(link.agoda_checkin_date.getTime() + 9 * 60 * 60 * 1000).toISOString()
                : '',
              endDate: link.agoda_checkout_date
                ? new Date(link.agoda_checkout_date.getTime() + 9 * 60 * 60 * 1000).toISOString()
                : '',
              //agoda_reservation_status == "Charged" 고 agoda_checkout_date 현재시간보다 이전이라면
              status: (() => {
                console.log('\x1b[97m\x1b[41m[CRITICAL] link.enddatetime:\x1b[0m', link.agoda_checkout_date);
                if (link.division === 'agoda') {
                  // enddatetime을 Date 객체로 변환
                  let baseDate: Date;
                  if (link.agoda_checkout_date instanceof Date) {
                    baseDate = link.agoda_checkout_date;
                  } else if (typeof link.agoda_checkout_date === 'number') {
                    baseDate = new Date(link.agoda_checkout_date * 1000);
                  } else {
                    baseDate = new Date(link.agoda_checkout_date);
                  }
                  console.log('\x1b[30m\x1b[106m[INFO] baseDate:\x1b[0m', baseDate);
                  // 1일 후 날짜 계산
                  const plusOneDay = new Date(baseDate.getTime() + 86400 * 1000);
                  const now = new Date();

                  // "오늘과 같거나 작다" => plusOneDay <= 오늘(시각까지 포함)
                  if (plusOneDay <= now && link.status === 400) {
                    return 400;
                  } else {
                    console.log('\x1b[30m\x1b[106m[INFO] link.status:\x1b[0m', link.status);
                    return statusMap[link.status];
                  }
                } else {
                  return link.status;
                }
              })(),
              total: link.tripMemberCash_total, // 결제금액
              deposit: link.tripMemberCash_deposit, // 수익금액
            })),
          };
        default:
          return {
            tripLinks: tripLinks.map((link) => ({
              ...link,
              ordername: this.safeDecodeURIComponent(link.product_name),
              ordertype: link.order_code,
              orderDate: this.formatDateFromDayTime(link.day, link.time),
              startDate: this.formatDateFromDayTime(link.day, link.time),
              endDate: this.formatDateFromDayTime(link.day, link.time),
              status: link.status,
              total: link.price, // 결제금액
              deposit: link.deposit, // 수익금액
            })),
          };
      }
    } catch (error) {
      console.error('Error in findTripLinks resolver:', error);
      return { tripLinks: [] }; // ✅ GraphQL 타입 일관성을 위해 fallback 반환
    }
  }

  private safeDecodeURIComponent(str: string): string {
    try {
      return decodeURIComponent(str);
    } catch (e) {
      return str; // 디코딩 불가 시 원본 반환
    }
  }

  private formatDateFromDayTime(day: string, time: string): string {
    if (!day || !time || day.length !== 8 || time.length !== 6) {
      return '';
    }

    const year = day.slice(0, 4);
    const month = day.slice(4, 6);
    const date = day.slice(6, 8);

    const hour = time.slice(0, 2);
    const minute = time.slice(2, 4);
    const second = time.slice(4, 6);

    // UTC 기준으로 날짜 객체 생성 후 KST로 변환
    const utcDate = new Date(`${year}-${month}-${date}T${hour}:${minute}:${second}Z`);
    const kstDate = new Date(utcDate.getTime()); // KST = UTC+9

    return kstDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
  }
  /**
   * 수익 내역 조회
   * @param authUser 액세스 토큰
   * @param type 필터 : 수익/출금
   * @param page
   * @param limit
   * @returns 수익 + 출금 내역
   */
  @Query('tripCashWithdrawal')
  @UseGuards(GqlAuthGuard)
  async showProfit(
    @AuthUser() authUser: Member,
    @Args('type', { nullable: true }) type?: string,
    @Args('page', { nullable: true }) page?: number,
    @Args('limit', { nullable: true }) limit?: number,
  ) {
    try {
      let cashResults = [];
      let withdrawalResults = [];

      if (!type || type === 'cash') {
        const rawCashResults = await this.tripMoneyService.showProfit(authUser, page, limit);
        // console.log('=>(trip-money.resolver.ts:110) rawCashResults', rawCashResults);
        const statusMap = {
          Charged: 100,
          'cancelled By Customer': 900,
          'Cancelled By Customer': 900,
          // 필요한 상태값들 매핑
        };
        console.log('test');
        cashResults = rawCashResults.map((link) => ({
          ...link,
          type: 'cash',
          memberId: link.memberId,
          ordername: link.ordername,
          createdAt: this.formatDate1(link.created_at),
          deposit: link.deposit, // 수익금액(% 적용된)
          orderamount: link.total, // 결제금액
          //division 3일 때만 statusMap 사용
          // status: link.division === 'agoda' ? statusMap[link.status] || 100 : link.status, // 상태값 매핑
          status: (() => {
            if (link.division === 'agoda') {
              // enddatetime을 Date 객체로 변환
              let baseDate: Date;
              if (link.enddatetime instanceof Date) {
                baseDate = link.enddatetime;
              } else if (typeof link.enddatetime === 'number') {
                baseDate = new Date(link.enddatetime * 1000);
              } else {
                baseDate = new Date(link.enddatetime);
              }
              console.log('\x1b[30m\x1b[106m[INFO] baseDate:\x1b[0m', baseDate);
              // 1일 후 날짜 계산
              const plusOneDay = new Date(baseDate.getTime() + 86400 * 1000);
              const now = new Date();

              // "오늘과 같거나 작다" => plusOneDay <= 오늘(시각까지 포함)
              const targetStatuses = ['Fully Booked', 'Confirmed', 'Departed', 'Charged'];
              // if (plusOneDay <= now && link.status === 'Charged') {
              if (plusOneDay <= now && targetStatuses.includes(link.status)) {
                return 400;
              } else {
                console.log('\x1b[30m\x1b[106m[INFO] link.status:\x1b[0m', link.status);
                return statusMap[link.status];
              }
            } else {
              return link.status;
            }
          })(),
          division: link.division,
          orderDate: this.formatDate(link.orderDate),
          startDate: this.formatDate(link.startdatetime),
          endDate: this.formatDate(link.enddatetime),
          //link.enddatetime + 2592000 YYYY-MM-DD
          // withdrawalDate: FROM_UNIXTIME_JS_YY_MM_DD(link.enddatetime + 2592000),
          // withdrawalDate: FROM_UNIXTIME_JS_YY_MM_DD(
          //   new Date(
          //     link.enddatetime instanceof Date
          //       ? link.enddatetime.getTime() + 2592000 * 1000
          //       : new Date(link.enddatetime).getTime() + 2592000 * 1000,
          //   ),
          // ),

          // withdrawalDate: (() => {
          //   let baseDate: Date;
          //
          //   if (link.enddatetime instanceof Date) {
          //     baseDate = link.enddatetime;
          //   } else if (typeof link.enddatetime === 'number') {
          //     baseDate = new Date(link.enddatetime * 1000); // 초 단위 → 밀리초
          //   } else {
          //     baseDate = new Date(link.enddatetime); // 문자열
          //   }
          //
          //   if (!baseDate || isNaN(baseDate.getTime())) return null;
          //
          //   return FROM_UNIXTIME_JS_YY_MM_DD(
          //     new Date(baseDate.getTime() + 2592000 * 1000), // 30일 후
          //   );
          // })(),
          withdrawalDate: (() => {
            let baseDate: Date;
            const { enddatetime, division } = link;

            if (enddatetime instanceof Date) {
              baseDate = enddatetime;
            } else if (typeof enddatetime === 'number') {
              baseDate = new Date(enddatetime * 1000); // 초 단위 → 밀리초
            } else {
              baseDate = new Date(enddatetime); // 문자열
            }

            if (!baseDate || isNaN(baseDate.getTime())) return null;

            // division이 'agoda' ,'trip','waug'면 1일 후, 아니면 30일 후로 설정
            // const addSeconds = division === 'agoda' ? 86400 : 2592000; // 1일 = 86400초, 30일 = 2592000초
            // const addSeconds = ['agoda', 'trip', 'waug'].includes(division) ? 86400 : 86400;
            const addSeconds = ['agoda', 'trip', 'waug'].includes(division)
              ? 86400
              : division === 400
              ? 86400
              : 2592000;
            const targetDate = new Date(baseDate.getTime() + addSeconds * 1000);

            return FROM_UNIXTIME_JS_YY_MM_DD(targetDate);
          })(),
        }));
      }

      if (!type || type === 'withdrawal') {
        const rawWithdrawalResults = await this.tripMoneyService.showWithdrawal(authUser);
        // console.log('=>(trip-money.resolver.ts:131) rawWithdrawalResults', rawWithdrawalResults);
        withdrawalResults = rawWithdrawalResults.map((link) => ({
          ...link,
          type: 'withdrawal',
          ordername: this.formatDateM(link.createdAt), // X월 출금
          createdAt: this.formatDate1(link.createdAt),
          deposit: link.withdrawalAmount,
          status: link.status,
          //          orderDate: this.formatDate(link.trip_orderdate),
          //          startDate: this.formatDate(link.trip_startdatetime),
          //          endDate: this.formatDate(link.trip_enddatetime),
        }));
      }

      const combinedResults = [...cashResults, ...withdrawalResults];

      return combinedResults;
    } catch (error) {
      console.error('Error in showTest resolver:', error);
      throw new Error('Failed to fetch lists');
    }
  }

  // 출금가능, 수익누적, 출금누적 금액 조회 & 출금 신청 상태
  @Query('tripMoneyStatus')
  @UseGuards(GqlAuthGuard)
  async showAmountOfMoney(@AuthUser() authUser: any) {
    // authUser = {
    //   idx: 18714,
    //   username: '안수민',
    //   // memberType: 1,
    //   phone: '01024585742',
    //   is_black: 1,
    //   // iat: 1742262139,
    //   // exp: 1742866939,
    // };
    try {
      //절약돼지 출금가능 금액
      const recommendWithdrawable = await this.tripMoneyService.showRecommendWithdrawable(authUser);
      const lastRecommendWithdrawal = await this.tripMoneyService.showLastRecommendWithdrawal(authUser);
      const statusRecommendResults = await this.tripMoneyService.showRecommendWithdrawalStatus(authUser);

      // authUser.idx = 30;
      const deposit = await this.tripMoneyService.showTotalDeposit(authUser);
      // console.log('\x1b[97m\x1b[41m[CRITICAL] deposit:\x1b[0m', deposit);
      const cancel = await this.tripMoneyService.showTotalCancel(authUser);
      // const profit = await this.tripMoneyService.showTotalProfit(authUser);
      const profit = await this.tripMoneyService.showProfitTotal(authUser);
      const withdrawal = await this.tripMoneyService.showTotalWithdrawal(authUser);
      const withdrawable = await this.tripMoneyService.showWithdrawable(authUser);
      const statusResults = await this.tripMoneyService.showWithdrawalStatus(authUser);
      const lastWithdrawal = await this.tripMoneyService.showLastWithdrawal(authUser);
      const confirmedWithdrawal = await this.tripMoneyService.showConfirmedWithdrawal(authUser);
      const expectedProfitAmount = await this.tripMoneyService.showExpectedProfitAmount(authUser);
      console.log('=>(trip-money.resolver.ts:119) expectedProfitAmount', expectedProfitAmount);
      if (lastWithdrawal) {
        lastWithdrawal.identificationCardImageKey = lastWithdrawal.identificationCardImageKey
          ? 'https://saving-pig.s3.ap-northeast-2.amazonaws.com/' + lastWithdrawal.identificationCardImageKey
          : null;
        lastWithdrawal.bankBookImageKey = lastWithdrawal.bankBookImageKey
          ? 'https://saving-pig.s3.ap-northeast-2.amazonaws.com/' + lastWithdrawal.bankBookImageKey
          : null;
      }

      if (lastRecommendWithdrawal) {
        lastRecommendWithdrawal.identificationCardImageKey = lastRecommendWithdrawal.identificationCardImageKey
          ? 'https://saving-pig.s3.ap-northeast-2.amazonaws.com/' + lastRecommendWithdrawal.identificationCardImageKey
          : null;
        lastRecommendWithdrawal.bankBookImageKey = lastRecommendWithdrawal.bankBookImageKey
          ? 'https://saving-pig.s3.ap-northeast-2.amazonaws.com/' + lastRecommendWithdrawal.bankBookImageKey
          : null;
      }

      const totalDeposit = parseFloat(deposit.totalDeposit) || 0;
      const totalCancel = parseFloat(cancel.totalDeposit) || 0;
      const totalProfit = parseFloat(profit) || 0;
      // console.log('\x1b[97m\x1b[41m[CRITICAL] totalProfit:\x1b[0m', totalProfit);
      // return;
      const confirmedWithdrawalTotal = parseFloat(confirmedWithdrawal.withdrawable) || 0;
      const expectedProfitAmountTotal = parseFloat(expectedProfitAmount.withdrawable) || 0;
      const totalWithdrawal = parseFloat(withdrawal.totalWithdrawal) || 0;
      const rawWithdrawable = parseFloat(withdrawable.withdrawable) || 0;
      console.log('\x1b[97m\x1b[41m[CRITICAL] rawWithdrawable:\x1b[0m', rawWithdrawable);
      const resultWithdrawable = Math.max(rawWithdrawable - totalWithdrawal, 0);
      // return resultWithdrawable;
      // console.log('=>(trip-money.resolver.ts:133) 누적 출금', totalWithdrawal);
      // console.log('=>(trip-money.resolver.ts:132) resultWithdrawable', resultWithdrawable);
      const resultLastWithdrawal = lastWithdrawal;

      // 출금 신청 내역 없을 땐 null 처리 (상태, 거절이유, 거절메세지)
      const { status = null, reasonIdx = null, denyReason = null } = statusResults ?? {};
      const { pigstatus = null, pigreasonIdx = null, pigdenyReason = null } = statusRecommendResults ?? {};
      const mappedResult = {
        memberId: deposit.memberId,
        totalDeposit: Math.round(totalDeposit), // 총 결제 금액
        totalCancel: Math.round(totalCancel), // 환불 금액
        totalProfit: totalProfit, // 수익 누적 금액
        confirmedWithdrawal: confirmedWithdrawalTotal, // 수익 확정 금액
        expectedProfitAmount: expectedProfitAmountTotal, // 예상 수익 금액
        totalWithdrawal: totalWithdrawal, // 출금 누적 금액
        totalWithdrawable: resultWithdrawable, // 출금 가능 금액
        statusResults: status,
        resultLastWithdrawal: resultLastWithdrawal,
        denyIdx: status === -1 ? reasonIdx : null, // 출금 거절 인덱스
        denyMsg: status === -1 ? denyReason : null, // 출금 거절 문구
        denyRecommendIdx: pigstatus === -1 ? pigreasonIdx : null, // 출금 거절 인덱스
        denyRecommendMsg: pigstatus === -1 ? pigdenyReason : null, // 출금 거절 문구
        recommendWithdrawable: recommendWithdrawable ? Math.round(recommendWithdrawable.withdrawable) : 0, // 절약돼지 출금 가능 금액
        resultLastRecommendWithdrawal: lastRecommendWithdrawal,
      };
      // console.log('=>(trip-money.resolver.ts:170) mappedResult', mappedResult);
      // console.log('Mapped result:', mappedResult);

      return mappedResult;
    } catch (error) {
      console.error('Error in showAmountOfMoney resolver:', error);
      throw new Error('Failed to fetch data');
    }
  }

  // // 수익 내역
  // @Query('tripCash')
  // @UseGuards(GqlAuthGuard)
  // async showProfit(@AuthUser() authUser: Member) {
  //   try {
  //     const rawResults = await this.tripMoneyService.showProfit(authUser);
  //     const mappedResults = rawResults.map((link) => ({
  //       ...link,
  //       memberId: link.tripCash_memberId,
  //       ordername: link.trip_ordername,
  //       orderDate: this.formatDate1(link.tripCash_orderDate),
  //       deposit: link.tripCash_deposit,
  //     }));

  //     console.log('Mapped results:', JSON.stringify(mappedResults, null, 2));

  //     return mappedResults;
  //   } catch (error) {
  //     console.error('Error in showProfit resolver:', error);
  //     throw new Error('Failed to fetch lists');
  //   }
  // }

  // // 출금 내역
  // @Query('tripWithdrawal')
  // @UseGuards(GqlAuthGuard)
  // async showWithdrawal(@AuthUser() authUser: Member) {
  //   try {
  //     const rawResults = await this.tripMoneyService.showWithdrawal(authUser);
  //     const mappedResults = rawResults.map((link) => ({
  //       ...link,
  //       created_at: this.formatDateMD(link.createdAt),
  //     }));
  //     return mappedResults;
  //   } catch (error) {
  //     console.error('Error in tripWithdrawal resolver:', error);
  //     throw new Error('Failed to fetch lists');
  //   }
  // }

  // // 'YYYY-MM-DD' 형식으로 반환 (UTC에서 한국시간 +9해줘야함)
  // private formatDate(timestamp: any): string {
  //   const date = new Date((timestamp + 32400) * 1000);
  //   return date.toISOString().split('T')[0];
  // }
  //
  // // 'YYYY-MM-DD' 형식으로 반환 (다른 형식)
  // private formatDate1(timestamp: any): string {
  //   const date = new Date(timestamp + 32400);
  //   return date.toISOString().split('T')[0];
  // }
  //
  // // 'MM.DD' 형식으로 변환
  // private formatDateMD(timestamp: any): string {
  //   const date = new Date(timestamp + 32400);
  //   return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  // }
  //
  // // 'MM' 형식으로 변환
  // private formatDateM(timestamp: any): string {
  //   const date = new Date(timestamp + 32400);
  //   return `${(date.getMonth() + 1).toString()}`;
  // }

  // 'YYYY-MM-DD' 형식 반환
  private formatDate(timestamp: any): string {
    const date = this.toKSTDate(timestamp);
    return date ? date.toISOString().split('T')[0] : '';
  }

  private formatDateL(timestamp: any): string {
    const date = this.toDate(timestamp);
    date.setDate(date.getDate() + 1);
    return date ? date.toISOString().split('T')[0] : '';
  }

  // 'YYYY-MM-DD' 형식 반환 (formatDate1 용)
  private formatDate1(timestamp: any): string {
    const date = this.toKSTDate(timestamp);
    return date ? date.toISOString().split('T')[0] : '';
  }

  // 'MM.DD' 형식 반환
  private formatDateMD(timestamp: any): string {
    const date = this.toKSTDate(timestamp);
    if (!date) return '';
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  }

  // 'MM' 형식 반환
  private formatDateM(timestamp: any): string {
    const date = this.toKSTDate(timestamp);
    if (!date) return '';
    return `${(date.getMonth() + 1).toString()}`;
  }

  // 내부 변환 함수: 모든 timestamp를 Date 객체(KST 기준)로 변환
  private toKSTDate(timestamp: any): Date | null {
    try {
      let date: Date;

      if (timestamp instanceof Date) {
        date = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000); // Date 타입
      } else if (typeof timestamp === 'number') {
        if (timestamp < 10000000000) {
          // UNIX 초(timestamp): 10자리 이하면 초로 간주
          date = new Date((timestamp + 9 * 60 * 60) * 1000);
        } else {
          // UNIX 밀리초(timestamp): 13자리 이상이면 그대로
          date = new Date(timestamp + 9 * 60 * 60 * 1000);
        }
      } else if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) return null;
        date = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
      } else {
        return null;
      }

      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private toDate(timestamp: any): Date | null {
    try {
      let date: Date;

      if (timestamp instanceof Date) {
        // 이미 Date 타입인 경우 그대로 사용
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        if (timestamp < 10000000000) {
          // UNIX 초 단위
          date = new Date(timestamp * 1000);
        } else {
          // UNIX 밀리초 단위
          date = new Date(timestamp);
        }
      } else if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) return null;
        date = parsed;
      } else {
        return null;
      }

      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
}
