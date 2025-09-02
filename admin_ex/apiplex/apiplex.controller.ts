import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiplexService } from './apiplex.service';

@Controller('apiplex')
export class ApiplexController {
  constructor(private readonly apiplexService: ApiplexService) {}

  /**
   * @Get()
   */
  @Get('test')
  findAll() {
    const data = {
      업체이름: '테스트업체',
      이름: '테스트이름',
      캠페인이름: '테스트캠페인',
      이용일자: '2021-10-10',
      인원: '10',
      채널주소: 'https://www.naver.com',

      자동신청마감시간: '2021-10-10 10:10:10',
      캠페인페이지승인링크: 'https://www.naver.com',
      적립금: 100,
    };
    // const hb2dkgadkhgb = this.apiplexService.sendPigUserAlimtalk('hb2dkgadkhgb', '01082308203', data);
    const zxsca1235gds = this.apiplexService.sendPigUserAlimtalk('zxsca1235gds', '01082308203', data);
    // const h56189d9g95g = this.apiplexService.sendPigUserAlimtalk('h56189d9g95g', '01082308203', data);
    // const hb2dkgadkhgb = this.apiplexService.sendPigUserAlimtalk('hb2dkgadkhgb', '01082308203', data);
  }

  @Get('apiplex_list')
  findApiplexList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), new ParseIntPipe({ errorHttpStatusCode: 422 })) limit: number,
    @Query('message', new DefaultValuePipe('')) message: string,
    @Query('phone', new DefaultValuePipe('')) phone: string,
    @Query('code', new DefaultValuePipe('')) code: string,
  ) {
    console.log('findApiplexList called with params:', { page, limit, message, phone, code });
    return this.apiplexService.findApiplexList(page, limit, message, phone, code);
  }
}
