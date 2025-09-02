import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ResizeImagePipe } from '../util/resize-image.pipe';
import { Response } from 'express';

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * @name getCategory
   * @description 제휴사 카테고리 조회
   * @method GET
   * @param {string} keyword
   * @returns {Promise<any>}
   */
  @Get('category')
  async getCategory(@Query('keyword') keyword: string): Promise<any> {
    return await this.affiliateService.getCategory(keyword);
  }

  /**
   * @name getCategoryDetail
   * @description 제휴사 카테고리 상세
   * @method GET
   * @param {number} idx
   * @returns {Promise<any>}
   */
  @Get('categoryDetail')
  async getCategoryDetail(@Query('idx') idx: number): Promise<any> {
    return await this.affiliateService.getCategoryDetail(idx);
  }

  /**
   * @name createCategory
   * @description 제휴사 카테고리 생성
   * @method POST
   * @param params
   * @returns {Promise<any>}
   */
  @Post('createCategory')
  async createCategory(@Body() params: any): Promise<any> {
    return await this.affiliateService.createCategory(params);
  }

  /**
   * @name updateCategory
   * @method PATCH
   * @description 제휴사 카테고리 수정
   * @param params
   * @returns {Promise<any>}
   */
  @Patch('updateCategory')
  async updateCategory(@Body() params: any): Promise<any> {
    return await this.affiliateService.updateCategory(params);
  }

  /**
   * 제휴사 카테고리 삭제
   */
  @Delete('deleteCategory')
  async deleteCategory(@Query('idx') idx: number): Promise<any> {
    return await this.affiliateService.deleteCategory(idx);
  }

  /**
   * @name getAffiliateOrderType
   * @description 제휴사 주문 타입 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */

  @Get('affiliateOrderType')
  async getAffiliateOrderType(@Query() params: any): Promise<any> {
    return await this.affiliateService.getAffiliateOrderType(params);
  }

  /**
   * @name getShortLinkList
   * @description 단축링크 리스트 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('shortLinkList')
  async getShortLinkList(@Query() params: any): Promise<any> {
    return await this.affiliateService.getShortLinkList(params);
  }

  @Get('shortLinkListDownload')
  async downloadExcel(@Query() params: any, @Res() res: Response) {
    return this.affiliateService.exportExampleExcel(res, params);
  }

  /**
   * @name getTripReservation
   * @description 트립 예약 리스트 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('tripReservation')
  async getTripReservation(@Query() params: any): Promise<any> {
    //status 상태값 - 100: 예약, 400: 완료, 900: 취소
    //ordertype 상태값 - 0: 일반, 1: 환불, 2: 취소
    console.log('=>(affiliate.controller.ts:35) params', params);
    return await this.affiliateService.getTripReservation(params);
  }

  /**
   * @name getWaugReservation
   * @description 와그 예약 리스트 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('waugReservation')
  async getWaugReservation(@Query() params: any): Promise<any> {
    console.log('=>(affiliate.controller.ts:56) params', params);
    return await this.affiliateService.getWaugReservation(params);
  }

  /**
   * @name getAgodaReservation
   * @description 아고다 예약 리스트 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('agodaReservation')
  async getAgodaReservation1(@Query() params: any): Promise<any> {
    console.log('=>(affiliate.controller.ts:67) params', params);
    return await this.affiliateService.getAgodaReservation(params);
  }

  @Get('linkPriceReservation')
  async getLinkPriceReservation(@Query() params: any): Promise<any> {
    console.log('=>(affiliate.controller.ts:67) params', params);
    return await this.affiliateService.getLinkPriceReservation(params);
  }

  /**
   * 출금 신청
   */

  /**
   * @name getWithdrawalApplicationList
   * @description 출금 신청 리스트 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('withdrawalApplicationList')
  async getWithdrawalApplicationList(@Query() params: any): Promise<any> {
    return await this.affiliateService.getWithdrawalApplicationList(params);
  }

  /**
   * @name getWithdrawalApplicationDetail
   * @description 출금 신청 상세 조회
   * @method GET
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Get('withdrawalApplicationDetail')
  async getWithdrawalApplicationDetail(@Query() params: any): Promise<any> {
    return await this.affiliateService.getWithdrawalApplicationDetail(params);
  }

  /**
   * @name changeWithdrawalStatus
   * @description 출금 신청 상태 변경
   * @method PATCH
   * @param {any} params
   * @returns {Promise<any>}
   */
  @Patch('changeWithdrawalStatus')
  async changeWithdrawalStatus(@Body() params: any): Promise<any> {
    return await this.affiliateService.changeWithdrawalStatus(params);
  }

  /**
   * @description 출금신청 삭제
   * @param idx
   * @return {Promise<any>}
   * @Delete('deleteWithdrawal')
   */
  @Delete('deleteWithdrawal')
  async deleteWithdrawal(@Body('idx') idx: number): Promise<any> {
    return await this.affiliateService.deleteWithdrawal(idx);
  }

  /**
   * 추천인 출금 신청
   */

  /**
   * @description 추천인 출금 신청 리스트 조회
   * @param params
   */
  @Get('getRecommendWithdrawalApplicationList')
  async getRecommendWithdrawalApplicationList(@Query() params: any): Promise<any> {
    return await this.affiliateService.getRecommendWithdrawalApplicationList(params);
  }

  /**
   * @description 추천인 출금 신청 상세 조회
   * @param params
   */
  @Get('getRecommendWithdrawalApplicationDetail')
  async getRecommendWithdrawalApplicationDetail(@Query() params: any): Promise<any> {
    return await this.affiliateService.getRecommendWithdrawalApplicationDetail(params);
  }

  /**
   * @description 추천인 출금 신청 상태 변경
   * @param params
   */
  @Patch('changeRecommendWithdrawalStatus')
  async changeRecommendWithdrawalStatus(@Body() params: any): Promise<any> {
    return await this.affiliateService.changeRecommendWithdrawalStatus(params);
  }

  /**
   * @description 추천인 출금 신청 삭제
   * @param idx
   */
  @Delete('deleteRecommendWithdrawal')
  async deleteRecommendWithdrawal(@Body('idx') idx: number): Promise<any> {
    return await this.affiliateService.deleteRecommendWithdrawal(idx);
  }

  /**
   * 제휴사 관리 부분
   */

  /**
   * @description 제휴사 관리 조회
   * @param keyword
   * @param page
   * @param take
   */
  @Get('getAffiliateManagement')
  async getAffiliateManagement(
    @Query('keyword') keyword: string,
    @Query('page') page: number,
    @Query('take') take: number,
  ): Promise<any> {
    return await this.affiliateService.getAffiliateManagement(keyword, page, take);
  }

  /**
   * @description 제휴사 관리 상세 조회
   * @param idx
   */
  @Get('getAffiliateManagementDetail')
  async getAffiliateManagementDetail(@Query('idx') idx: number): Promise<any> {
    return await this.affiliateService.getAffiliateManagementDetail(idx);
  }

  @Get('getAffiliateManagementDetails')
  async getAffiliateManagementDetails(@Query('idx') idx: number): Promise<any> {
    return await this.affiliateService.getAffiliateManagementDetails(idx);
  }

  /**
   * @description 제휴사 관리 생성
   * @param files
   * @param body
   */
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'icon_svg', maxCount: 1 },
      { name: 'event_banner', maxCount: 1 },
    ]),
  )
  @Post('createAffiliateManagement')
  async createAffiliateManagement(
    @UploadedFiles()
    files: {
      icon_svg?: Express.Multer.File[];
      event_banner?: Express.Multer.File[];
    },
    @Body() body: any,
  ): Promise<any> {
    return await this.affiliateService.createAffiliateManagement(files, body);
  }

  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'icon_svg', maxCount: 1 },
      { name: 'event_banner', maxCount: 10 },
    ]),
  )
  @Post('createAffiliateManagements')
  async createAffiliateManagements(
    @UploadedFiles()
    files: {
      icon_svg?: Express.Multer.File[];
      event_banner?: Express.Multer.File[];
    },
    @Body() body: any,
  ): Promise<any> {
    return await this.affiliateService.createAffiliateManagements(files, body);
  }

  /**
   * @description 제휴사 관리 수정
   * @param files
   * @param body
   */
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'icon_svg', maxCount: 1 },
      { name: 'event_banner', maxCount: 1 },
    ]),
  )
  @Patch('updateAffiliateManagement')
  async updateAffiliateManagement(
    @UploadedFiles()
    files: {
      icon_svg?: Express.Multer.File[];
      event_banner?: Express.Multer.File[];
    },
    @Body() body: any,
  ): Promise<any> {
    return await this.affiliateService.updateAffiliateManagement(files, body);
  }

  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'icon_svg', maxCount: 1 },
      { name: 'event_banner', maxCount: 10 },
    ]),
  )
  @Patch('updateAffiliateManagements')
  async updateAffiliateManagements(
    @UploadedFiles()
    files: {
      icon_svg?: Express.Multer.File[];
      event_banner?: Express.Multer.File[];
    },
    @Body() body: any,
  ): Promise<any> {
    return await this.affiliateService.updateAffiliateManagements(files, body);
  }

  /**
   * @description 제휴사 관리 삭제
   * @param idx
   */
  @Delete('deleteAffiliateManagement')
  async deleteAffiliateManagement(@Query('idx') idx: number): Promise<any> {
    return await this.affiliateService.deleteAffiliateManagement(idx);
  }

  /**
   * getTripDenyReasons
   */
  @Get('getTripDenyReasons')
  async getTripDenyReasons(): Promise<any> {
    return await this.affiliateService.getTripDenyReasons();
  }

  /**
   * @description 제휴사 순서 변경
   * @param body
   * @returns {Promise<any>}
   */
  @Patch('updateAffiliateOrder')
  async updateAffiliateOrder(@Body() body: any): Promise<any> {
    return await this.affiliateService.updateAffiliateOrder(body);
  }

  /**
   * @description 링크프라이스 데이터 수신
   * @param body
   * @returns {Promise<any>}
   * @Post('receiveLinkPriceData')
   */
  @Post('receiveLinkPriceData')
  async receiveLinkPriceData(@Body() body: any): Promise<any> {
    console.log('=>(receiveLinkPriceData.ts:340) body', body);
    return await this.affiliateService.receiveLinkPriceData(body);
  }

  /**
   * @description 링크프라이스 데이터 조회
   * @param {any} params
   * @returns {Promise<any>}
   * @Get('getLinkPriceData')
   */
  @Get('getLinkPriceData')
  async getLinkPriceData(@Query() params: any): Promise<any> {
    return await this.affiliateService.getLinkPriceData(params);
  }
  //https://click.linkprice.com/click.php?m=agoda&a=A100696547&l=0000
  @Post('linkTestData')
  async linkTestData(@Body() body: any): Promise<any> {
    return await this.affiliateService.linkTestData(body);
  }

  @Get('getLinkPriceList')
  async getLinkPriceList(@Query() params: any): Promise<any> {
    return await this.affiliateService.getLinkPriceList(params);
  }

  /**
   * @description 트립 예약현황 엑셀 출력
   */
  @Get('tripReservationExcel')
  async tripReservationExcel(@Query() params: any, @Res() res: Response): Promise<any> {
    return await this.affiliateService.tripReservationExcel(res, params);
  }

  /**
   * @description 와그 예약현황 엑셀 출력
   */
  @Get('waugReservationExcel')
  async waugReservationExcel(@Query() params: any, @Res() res: Response): Promise<any> {
    return await this.affiliateService.waugReservationExcel(res, params);
  }

  /**
   * @description 아고다 예약현황 엑셀 출력
   */
  @Get('agodaReservationExcel')
  async agodaReservationExcel(@Query() params: any, @Res() res: Response): Promise<any> {
    return await this.affiliateService.agodaReservationExcel(res, params);
  }

  /**
   * @description 링크프라이스 예약현황 엑셀 출력
   */
  @Get('linkPriceReservationExcel')
  async linkPriceReservationExcel(@Query() params: any, @Res() res: Response): Promise<any> {
    return await this.affiliateService.linkPriceReservationExcel(res, params);
  }

  /**
   * @description 제휴사 예약현황 엑셀 통합 출력
   */
  @Get('reservationExcel')
  async reservationExcel(@Query() params: any, @Res() res: Response): Promise<any> {
    return await this.affiliateService.reservationExcel(res, params);
  }
}
