import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express'; // Response import 추가
import { ExcelService } from './excel.service';
import { nowDate } from '../util/util';
// import { AuthUser } from '../auth/auth-user.decorator';
// import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Get('member')
  // @UseGuards(JwtAuthGuard)
  async member(
    // @AuthUser() user: any,
    @Query() params: any,
    @Res() res: Response,
  ) {
    const nowString = nowDate();
    const fileName = `member_${nowString}.xlsx`;

    const buffer = await this.excelService.member(params);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); // Content-Type 설정
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`); // Content-Disposition 설정
    // res.setHeader('Content-Disposition', `attachment; filename=example.xlsx`); // Content-Disposition 설정
    res.send(buffer);
  }
}
