import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin_dashboard.service';
import { AuthUser } from '../auth/auth-user.decorator';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
@Controller('admin-dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async main(@AuthUser() user: any) {
    console.log('=>(admin_dashboard.controller.ts:17) user', user);
    return await this.adminDashboardService.main(user);
  }

  @Post('scheduleChange')
  async scheduleChange(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:22) body', body);
    return await this.adminDashboardService.scheduleChange(body);
  }

  @Post('policyChange')
  async policyChange(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:28) body', body);
    return await this.adminDashboardService.policyChange(body);
  }

  @Post('growthSilver')
  async growthSilver(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.growthSilver(body);
  }

  @Post('refuseSilver')
  async refuseSilver(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.refuseSilver(body);
  }

  @Post('dormancyUser')
  async dormancyUser(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.dormancyUser(body);
  }

  @Post('dormantStateChange')
  async dormantStateChange(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.dormantStateChange(body);
  }

  @Post('channelUpgrade')
  async channelUpgrade(@Body() body: any) {
    try {
      console.log('=>(admin_dashboard.controller.ts:34) body', body);
      //body.urls 를 , 구분으로 배열화
      const data = body.urls.split(',');
      console.log('=>(admin_dashboard.controller.ts:58) data', data);

      return await this.adminDashboardService.channelUpgrade(data);
    } catch (e) {
      console.log('=>(admin_dashboard.controller.ts:62) e', e);
    }
  }

  /**
   * 트립 링크 생성
   * @param body
   * @returns {Promise<any>}
   */
  @Post('tripLink')
  async tripLink(@Body() body: any): Promise<any> {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.tripLink(body);
  }

  /**
   * 숏링크 생성
   * @param body
   * @param body.memberId
   * @param body.tripUrl
   * @returns {Promise<any>}
   */
  @Post('shortLink')
  async shortLink(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.shortLink(body);
  }

  @Post('delIdentityVerification')
  async delIdentityVerification(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.delIdentityVerification(body);
  }

  @Post('blockUser')
  async blockUser(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.blockUser(body);
  }

  /**
   * 머천트별 수익금 월별 현황 및 누적
   * @param body
   */
  @Post('merchantProfit')
  async merchantProfit(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.merchantProfitAll(body);
  }

  /**
   * 회원 가입 현황 일자별
   * @param body
   * @param body.startDate 시작일
   * @param body.endDate 종료일
   */
  @Post('memberJoinDay')
  async memberJoinDay(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.memberJoinDay(body);
  }

  /**
   * 회원 가입 현황 월별
   * @param body
   * @param body.year 년도
   */
  @Post('memberJoinMonth')
  async memberJoinMonth(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.memberJoinMonthAll(body);
  }

  /**
   * 절약돼지 추천인 코드로 가입한 회원 주단위 상위 5명
   * @param body
   */
  @Post('memberJoinPigCode')
  async memberJoinPigCode(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.memberJoinPigCode(body);
  }

  /**
   * 와이리 추천인 코드로 가입한 회원 주단위 상위 5명
   */
  @Post('memberJoinWiriCode')
  async memberJoinWiriCode(@Body() body: any) {
    console.log('=>(admin_dashboard.controller.ts:34) body', body);
    return await this.adminDashboardService.memberJoinWiriCode();
  }
}
