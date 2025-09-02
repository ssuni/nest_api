import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../../entity/entities/Member';
import { MemberChannel } from '../../entity/entities/MemberChannel';
import { Campaign } from '../../entity/entities/Campaign';
import { CampaignImage } from '../../entity/entities/CampaignImage';
import { CampaignItem } from '../../entity/entities/CampaignItem';
import { CampaignItemImage } from '../../entity/entities/CampaignItemImage';
import { CampaignSubmit } from '../../entity/entities/CampaignSubmit';
import { CampaignItemSchedule } from '../../entity/entities/CampaignItemSchedule';
import { CampaignReview } from '../../entity/entities/CampaignReview';
import { Cate } from '../../entity/entities/Cate';
import { CateArea } from '../../entity/entities/CateArea';
import { Workbook } from 'exceljs';
import { AES_DECRYPT, timeToTimestamp } from '../util/util';

@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    @InjectRepository(MemberChannel)
    private memberChannelRepository: Repository<MemberChannel>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignImage)
    private campaignImageRepository: Repository<CampaignImage>,
    @InjectRepository(CampaignItem)
    private campaignItemRepository: Repository<CampaignItem>,
    @InjectRepository(CampaignItemImage)
    private campaignItemImageRepository: Repository<CampaignItemImage>,
    @InjectRepository(CampaignSubmit)
    private campaignSubmitRepository: Repository<CampaignSubmit>,
    @InjectRepository(CampaignItemSchedule)
    private campaignItemScheduleRepository: Repository<CampaignItemSchedule>,
    @InjectRepository(CampaignReview)
    private campaignReviewRepository: Repository<CampaignReview>,
    @InjectRepository(Cate)
    private cateRepository: Repository<Cate>,
    @InjectRepository(CateArea)
    private cateAreaRepository: Repository<CateArea>,
  ) {}

  //
  async makeSheet(data: any, sheetName: string) {
    try {
      const workbook = new Workbook();
      // create first sheet with file name exceljs-example
      const worksheet = workbook.addWorksheet(sheetName);

      //     //data의 key 값으로 header를 생성
      const header = Object.keys(data[0]);
      const headerRow = worksheet.addRow(header);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF00' }, // Yellow color
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' }; // 텍스트를 가운데 정렬
      });
      switch (sheetName) {
        case '회원정보':
          await this.setMemberSheet(header, worksheet, data);
          break;
      }
      return await workbook.xlsx.writeBuffer();
    } catch (e) {
      console.log('=>(excel.service.ts:47) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  //
  async member(data: any) {
    try {
      const query = this.memberRepository.createQueryBuilder('member');
      query.select('member.idx', '회원번호');
      query.addSelect('member.type', '타입');
      query.addSelect('member.status', '상태');
      query.addSelect(`(${AES_DECRYPT('name')})`, '이름');
      query.addSelect(`(${AES_DECRYPT('phone')})`, '연락처');
      query.addSelect(`(${AES_DECRYPT('email')})`, '이메일');
      query.addSelect(`FROM_UNIXTIME(regdate, '%Y-%m-%d %H:%i:%s')`, '가입일');
      query.where('1=1');
      if (data.type) {
        query.andWhere('member.type = :type', { type: data.type });
      }
      if (data.status) {
        query.andWhere('member.status = :status', { status: data.status });
      }
      //data.startDate && data.endDate 'YYYY-MM-DD' 형식을 유닉스타임 값으로 변환후 range 조회
      if (data.startDate && data.endDate) {
        query.andWhere('member.regdate BETWEEN :startDate AND :endDate', {
          startDate: timeToTimestamp(data.startDate),
          endDate: timeToTimestamp(data.endDate),
        });
      }
      const members = await query.orderBy('regdate', 'DESC').getRawMany();

      // members 에 등록채널목록 정보를 추가하여 출력
      for (let i = 0; i < members.length; i++) {
        members[i].등록채널목록 = await this.memberChannelRepository
          .createQueryBuilder('memberChannel')
          // .select('memberChannel.idx', '채널번호')
          .select('memberChannel.link', 'link')
          .addSelect('memberChannel.level', 'level')
          .where('memberChannel.memberIdx = :memberIdx', { memberIdx: members[i].회원번호 })
          .getRawMany();
      }
      return await this.makeSheet(members, '회원정보');
    } catch (e) {
      console.log('=>(excel.service.ts:60) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async setMemberSheet(header: any, worksheet: any, data: any) {
    const columnWidths = {
      이름: 20,
      연락처: 20,
      이메일: 40,
      가입일: 40,
      등록채널목록: 100, // 새롭게 추가한 열의 너비
    };

    // 열 너비 설정 적용
    Object.keys(columnWidths).forEach((columnName) => {
      const columnIndex = header.indexOf(columnName) + 1;
      if (columnIndex > 0) {
        worksheet.getColumn(columnIndex).width = columnWidths[columnName];
      }
    });
    //회원정보의 경우 등록채널목록 정보를 병합하여 출력 worksheet.addRow([1, 'John Doe', 'john@example.com']); 이 형식으로 생성
    data.forEach((member) => {
      const row = [];
      header.forEach((key) => {
        if (key === '등록채널목록') {
          if (member[key]) {
            // 열이 존재하는 경우에만 처리
            const addRow = [];
            member[key].forEach((channel) => {
              // '등록채널목록': [ [Object], [Object], [Object] ] 형식을 '채널명1|| 채널명2|| 채널명3' 으로 변환
              // channel.link 의 값만 추출하여 배열로 변환후 join

              let level = '';
              switch (channel.level) {
                case 0:
                  level = '승인대기';
                  break;
                case 1:
                  level = '인플루언서';
                  break;
                case 2:
                  level = '성장형 인플루언서';
                  break;
                case 9:
                  level = '재승인요청';
                  break;
                case -1:
                  level = '승인거절';
                  break;
              }
              const innerDate = channel.link + '(' + level + ')';
              addRow.push(innerDate);
            });
            row.push(addRow.join('      ||      '));
          } else {
            row.push(''); // 해당 열이 없는 경우 빈 문자열로 채움
          }
        } else {
          row.push(member[key]);
        }
      });
      // worksheet.addRow(row);
      const newRow = worksheet.addRow(row);
      newRow.eachCell((cell, index) => {
        // console.log('Column Name:', header[index]);
        if (index == 8) {
          // cell 크기 조정
          cell.alignment = { horizontal: 'left', vertical: 'middle' }; // '등록채널목록'은 왼쪽 정렬
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }; // 나머지는 가운데 정렬
        }
      });
    });

    return worksheet;
  }
}
