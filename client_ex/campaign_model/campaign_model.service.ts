import { HttpException, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Campaign } from '../../../entity/entities/Campaign';
import { CampaignItem } from '../../../entity/entities/CampaignItem';
import { CampaignItemSchedule } from '../../../entity/entities/CampaignItemSchedule';
import { CampaignSubmit } from '../../../entity/entities/CampaignSubmit';
import { CateArea } from '../../../entity/entities/CateArea';
import { Cate } from '../../../entity/entities/Cate';
import { bufferToString } from '../../util/common';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignItem)
    private campaignItemRepository: Repository<CampaignItem>,
    @InjectRepository(CampaignItemSchedule)
    private campaignItemScheduleRepository: Repository<CampaignItemSchedule>,
    @InjectRepository(CampaignSubmit)
    private campaignSubmitRepository: Repository<CampaignSubmit>,
    @InjectRepository(CateArea)
    private cateAreaRepository: Repository<CateArea>,
    @InjectRepository(Cate)
    private cateRepository: Repository<Cate>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
  }

  /*
        최신순: regdate
        인기순: submitCount
     */
  async getProducts(sort: string) {
    const stockQuery = await this.campaignRepository.createQueryBuilder('c')
      .leftJoin(CampaignItem, 'ci', 'ci.campaignIdx = c.idx')
      .leftJoin(CampaignItemSchedule, 'cis', 'cis.itemIdx = ci.idx')
      .select('c.idx', 'campaignIdx')
      .where('c.status = :status', { status: 200 })
      .groupBy('c.idx')
      .having('COALESCE(SUM(cis.stock), 0) < :threshold', { threshold: 1 })
      .getRawMany();

    const stockIdxs = stockQuery.map((item) => {
      return item.campaignIdx;
    });
    console.log('=>(campaign.service.ts:214) stockIdxs', stockIdxs);

    let campaign: any[];
    try {
      if (sort == 'recent') {
        const query = this.campaignRepository.createQueryBuilder('campaign');
        query.leftJoin('campaign.campaignItem', 'campaignItem');
        query.leftJoin('campaignItem.campaignItemSchedule', 'campaignItemSchedule');
        query.leftJoin('campaign.partner', 'partner');
        query.select([
          'campaign.idx as idx',
          'campaign.name as name',
          'campaign.approvalMethod as approvalMethod',
          'campaign.grade as grade',
          'campaign.manuscriptFee as manuscriptFee',
          'campaign.status as status',
          'campaign.regdate as regdate',
          'campaign.weight as weight',
          'campaign.cateIdx as cateIdx',
          'campaign.cateAreaIdx as cateAreaIdx',
          'CONCAT("https://wairi.co.kr/img/campaign/",(select file_name from campaignImage where campaignIdx = campaign.idx order by ordering asc limit 1)) as image',
          '(select file_name from campaignImage where campaignIdx = campaign.idx order by ordering asc limit 1) as image2',
        ]);
        if (process.env.PORT == '3000' || process.env.PORT == '4000') {
          console.log('=>(campaign_model.service.ts:57) process.env.PORT', process.env.PORT);
          query.addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          );
        }
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('priceOrig')
              .from('campaignItem', 'ci')
              .where('ci.campaignIdx = campaign.idx')
              .andWhere('ci.remove = 0')
              .orderBy('priceOrig', 'ASC')
              .limit(1),
          'lowestPriceOrig',
        );
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('priceDeposit')
              .from('campaignItem', 'ci')
              .where('ci.campaignIdx = campaign.idx')
              .andWhere('ci.remove = 0')
              .orderBy('priceDeposit', 'ASC')
              .limit(1),
          'lowestPriceDeposit',
        );
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('dc11')
              .from('campaignItem', 'ci')
              .where('ci.campaignIdx = campaign.idx')
              .andWhere('ci.remove = 0')
              .orderBy('dc11', 'ASC')
              .limit(1),
          'discountPercentage',
        );
        query.where('campaign.remove = :remove', { remove: 0 });
        query.andWhere('campaignItem.remove = :cr', { cr: 0 });
        query.andWhere('campaign.status = 200');
        // .andWhere('campaign.status >= :t', {t: 200})
        // .andWhere('campaign.status <= :s', {s: 700})
        query.andWhere('partner.status = :status', { status: 1 });
        // .orderBy('campaign.weight', 'DESC')
        query.addOrderBy('campaign.regdate', 'DESC');
        query.groupBy('campaign.idx');
        query.limit(8);
        campaign = await query.getRawMany();
      } else if (sort == 'popular') {
        const submitCount = this.campaignSubmitRepository
          .createQueryBuilder()
          .subQuery()
          .select(['campaignSubmit.campaignIdx as campaignIdx', 'COUNT(*) AS submitCount'])
          .from(CampaignSubmit, 'campaignSubmit')
          .where('campaignSubmit.status > 0')
          .andWhere('campaignSubmit.status < 900')
          .groupBy('campaignSubmit.campaignIdx')
          .getQuery();

        const query = await this.campaignRepository.createQueryBuilder('campaign');
        query.select([
          'campaign.idx as idx',
          'campaign.name as name',
          'campaign.status as status',
          'campaign.approvalMethod as approvalMethod',
          'campaign.grade as grade',
          'campaign.manuscriptFee as manuscriptFee',
          'campaign.regdate as regdate',
          'campaign.weight as weight',
          'campaign.cateIdx as cateIdx',
          'campaign.cateAreaIdx as cateAreaIdx',
          'CONCAT("https://wairi.co.kr/img/campaign/",(select file_name from campaignImage where campaignIdx = campaign.idx order by ordering asc limit 1)) as image',
        ]);
        if (process.env.PORT == '3000' || process.env.PORT == '4000') {
          console.log('=>(campaign_model.service.ts:57) process.env.PORT', process.env.PORT);
          query.addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          );
        }
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('priceOrig')
              .from('campaignItem', 'ci')
              .where('ci.campaignIdx = campaign.idx')
              .andWhere('ci.remove = 0')
              .orderBy('priceOrig', 'ASC')
              .limit(1),
          'lowestPriceOrig',
        );
        query
          .addSelect(
            (subQuery) =>
              subQuery
                .select('dc11')
                .from('campaignItem', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .andWhere('ci.remove = 0')
                .orderBy('dc11', 'ASC')
                .limit(1),
            'discountPercentage',
          );

        //campaginItemSchedule date가 현재 날짜보다 크거나 같은것중 stock 의 총합
        // query.addSelect(
        //   (subQuery) =>
        //     subQuery
        //       .select('SUM(cis.stock)')
        //       .from('campaignItemSchedule', 'cis')
        //       .where('cis.itemIdx = campaignItem.idx')
        //       .andWhere('cis.date >= UNIX_TIMESTAMP(CURDATE())')
        //       .andWhere('cis.stock > 0'),
        //   'totalStock',
        // )

        // .leftJoin(submitCount, 'campaignSubmit', 'campaignSubmit.campaignIdx = campaign.idx')
        query.leftJoin('campaign.campaignItem', 'campaignItem');
        query.leftJoin('campaignItem.campaignItemSchedule', 'campaignItemSchedule');
        query.leftJoin('campaign.partner', 'partner');
        query.where('campaign.remove = :remove', { remove: 0 });
        query.andWhere('campaignItem.remove = :cr', { cr: 0 });
        query.andWhere('campaign.status = 200');
        query.andWhere('partner.status = :status', { status: 1 });
//stockIdxs 배열에 값이 있으면 제외
        if (stockIdxs.length > 0) {
          query.andWhere('campaign.idx NOT IN (:...stockIdxs)', { stockIdxs: stockIdxs });
        }

        // .andWhere('totalStock > 0')
        // .andWhere('campaignItem.endDate > UNIX_TIMESTAMP(NOW())')
        // .orderBy("submitCount", 'DESC')
        // .addOrderBy('weight', 'DESC')
        query.orderBy('weight', 'DESC');
        // .orderBy("submitCount", 'DESC')
        query.addOrderBy('regdate', 'DESC')
          .groupBy('campaign.idx')
          //HAVING totalStock > 0
          // .having('totalStock > 0')

          .limit(8);
        campaign = await query.getRawMany();
      } else {
        const query = await this.campaignRepository.createQueryBuilder('campaign');
        query.select([
          'campaign.idx as idx',
          'campaign.name as name',
          'campaign.status as status',
          'campaign.approvalMethod as approvalMethod',
          'campaign.grade as grade',
          'campaign.manuscriptFee as manuscriptFee',
          'campaign.regdate as regdate',
          'campaign.weight as weight',
          'campaign.cateIdx as cateIdx',
          'campaign.cateAreaIdx as cateAreaIdx',
          'campaign.approvalRate as approvalRate',
          // 'ROUND((recentSubmitCount.submitCount / recentSubmitCountTotal.submitCount) * 100) AS approvalRate',
          'CONCAT("https://wairi.co.kr/img/campaign/",(select file_name from campaignImage where campaignIdx = campaign.idx order by ordering asc limit 1)) as image',
        ]);
        if (process.env.PORT == '3000' || process.env.PORT == '4000') {
          console.log('=>(campaign_model.service.ts:57) process.env.PORT', process.env.PORT);
          query.addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          );
        }
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('priceOrig')
              .from('campaignItem', 'ci')
              .where('ci.campaignIdx = campaign.idx')
              .andWhere('ci.remove = 0')
              .orderBy('priceOrig', 'ASC')
              .limit(1),
          'lowestPriceOrig',
        );
        query
          .addSelect(
            (subQuery) =>
              subQuery
                .select('dc11')
                .from('campaignItem', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .andWhere('ci.remove = 0')
                .orderBy('dc11', 'ASC')
                .limit(1),
            'discountPercentage',
          );
        //campaginItemSchedule date가 현재 날짜보다 크거나 같은것중 stock 의 총합
        query.addSelect(
          (subQuery) =>
            subQuery
              .select('SUM(cis.stock)')
              .from('campaignItemSchedule', 'cis')
              .where('cis.itemIdx = campaignItem.idx')
              .andWhere('cis.date >= UNIX_TIMESTAMP(CURDATE())')
              .andWhere('cis.stock > 0'),
          'totalStock',
        )
          // .leftJoin(submitCount, 'campaignSubmit', 'campaignSubmit.campaignIdx = campaign.idx')
          // .leftJoin(recentSubmitCount, 'recentSubmitCount', 'recentSubmitCount.campaignIdx = campaign.idx')
          // .leftJoin(recentSubmitCountTotal, 'recentSubmitCountTotal', 'recentSubmitCountTotal.campaignIdx = campaign.idx')
          .leftJoin('campaign.campaignItem', 'campaignItem')
          .leftJoin('campaignItem.campaignItemSchedule', 'campaignItemSchedule')
          .leftJoin('campaign.partner', 'partner')
          .where('campaign.remove = :remove', { remove: 0 })
          .andWhere('campaignItem.remove = :cr', { cr: 0 })
          .andWhere('campaign.status = 200')
          .andWhere('partner.status = :status', { status: 1 })
          // .andWhere('totalStock > 0')
          .orderBy('campaign.approvalRate', 'DESC')
          .addOrderBy('regdate', 'DESC')
          .groupBy('campaign.idx')
          .having('totalStock > 0')
          .limit(8);
        campaign = await query.getRawMany();
      }

      let cate = await this.cateRepository.createQueryBuilder('cate').select('*').getRawMany();

      let cateArea = await this.cateAreaRepository.createQueryBuilder('cateArea').select('*').getRawMany();

      campaign = bufferToString(campaign);
      cate = bufferToString(cate);
      cateArea = bufferToString(cateArea);

      campaign.forEach((item, index) => {
        item.discountPrice = Math.round((item.lowestPriceOrig * item.discountPercentage) / 100);
        item.category = cate
          .filter((cateItem, cateIndex) => {
            return cateItem.idx == item.cateIdx;
          })
          .map((cateItem, cateIndex) => {
            return {
              ...cateItem,
              cateArea: cateArea.filter((cateAreaItem, cateAreaIndex) => {
                return cateAreaItem.idx == item.cateAreaIdx;
              }),
            };
          });
      });

      return campaign;

      // let campaignItem = await this.campaignItemRepository
      //     .createQueryBuilder('campaignItem')
      //     .select('*')
      //     .where("campaignItem.remove != 1")
      //     .getRawMany()
      //
      // let campaignItemLowestPrice = await this.campaignRepository
      //     .createQueryBuilder('c')
      //     .select('c.idx', 'campaignIdx')
      //     .addSelect('c.name', 'campaignName')
      //     .addSelect(
      //         (subQuery) =>
      //             subQuery
      //                 .select('priceOrig')
      //                 .from('campaignItem', 'ci')
      //                 .where('ci.campaignIdx = c.idx')
      //                 .andWhere('ci.remove = 0')
      //                 .orderBy('priceOrig', 'ASC')
      //                 .limit(1),
      //         'lowestPrice'
      //     )
      //     .addSelect(
      //         (subQuery) =>
      //             subQuery
      //                 .select('dc11')
      //                 .from('campaignItem', 'ci')
      //                 .where('ci.campaignIdx = c.idx')
      //                 .andWhere('ci.remove = 0')
      //                 .orderBy('dc11', 'ASC')
      //                 .limit(1),
      //         'dc11'
      //     )
      //     .where('c.status = 200')
      //     // .where('c.status >= :t', {t: 200})
      //     // .andWhere('c.status <= :s', {s: 700})
      //     .andWhere('c.remove = 0')
      //     .orderBy('c.weight', 'DESC')
      //     .addOrderBy('c.regdate', 'DESC')
      //     .getRawMany();
      //
      // let campaignItemSchedule = await this.campaignItemScheduleRepository
      //     .createQueryBuilder('campaignItemSchedule')
      //     .select('*')
      //     .getRawMany()
      //
      //
      // let cate = await this.cateRepository
      //     .createQueryBuilder('cate')
      //     .select('*')
      //     .getRawMany()
      //
      // let cateArea = await this.cateAreaRepository
      //     .createQueryBuilder('cateArea')
      //     .select('*')
      //     .getRawMany()
      //
      // if(campaign){
      //     campaign = bufferToString(campaign)
      //     campaignItem = bufferToString(campaignItem)
      //     campaignItemSchedule = bufferToString(campaignItemSchedule)
      //     cate = bufferToString(cate)
      //     cateArea = bufferToString(cateArea)
      //     campaignItemLowestPrice = bufferToString(campaignItemLowestPrice)
      // }
      //
      // let result = [];
      // campaign.forEach((item, index) => {
      //     campaignItemLowestPrice.forEach((campaignItemLowestPriceItem, campaignItemLowestPriceIndex) => {
      //         if(item.idx == campaignItemLowestPriceItem.campaignIdx){
      //             item.lowestPriceOrig = campaignItemLowestPriceItem.lowestPrice;
      //             item.discountPercentage = campaignItemLowestPriceItem.dc11;
      //             item.discountPrice = Math.round(item.lowestPriceOrig * item.discountPercentage / 100);
      //         }
      //     })
      //     result.push({
      //         ...item,
      //         campaignItem: campaignItem.filter((campaignItemItem, campaignItemIndex) => {
      //             return campaignItemItem.campaignIdx == item.idx
      //         }).map((campaignItemItem, campaignItemIndex) => {
      //             return {
      //                 ...campaignItemItem,
      //                 campaignItemSchedule: campaignItemSchedule.filter((campaignItemScheduleItem, campaignItemScheduleIndex) => {
      //
      //                     return campaignItemScheduleItem.itemIdx == campaignItemItem.idx
      //                 })
      //             }
      //         }),
      //         category: cate.filter((cateItem, cateIndex) => {
      //             return cateItem.idx == item.cateIdx
      //         }).map((cateItem, cateIndex) => {
      //           return {
      //                 ...cateItem,
      //                 cateArea: cateArea.filter((cateAreaItem, cateAreaIndex) => {
      //                        return cateAreaItem.idx == item.cateAreaIdx
      //                 })
      //           }
      //         })
      //     })
      // })
      // return result;
    } catch (error) {
      console.log('=>(campaign_model.service.ts:196) error', error);
      throw new HttpException(error.message, error.status);
    }
  }

  // /**
  //  * 기본 캠페인 쿼리를 생성하는 함수
  //  * 캠페인에 관련된 기본 정보와 필요한 조인 테이블들을 설정한 후, 쿼리 빌더 객체를 반환.
  //  * @param campaignRepository - 캠페인 데이터를 관리하는 리포지토리
  //  * @returns {SelectQueryBuilder} - 캠페인 관련 데이터베이스 쿼리 빌더 객체
  //  */
  // createBaseCampaignQuery(campaignRepository) {
  //   const query = campaignRepository.createQueryBuilder('campaign');
  //
  //   /**
  //    * 캠페인 정보와 필요한 조인 테이블들을 설정
  //    * - campaign: 캠페인 정보
  //    * - cate: 캠페인 카테고리 정보
  //    * - cateArea: 캠페인 지역 카테고리 정보
  //    * - campaignItem: 캠페인 상품 정보
  //    * - campaignItemSchedule: 캠페인 상품 일정 정보
  //    * - partner: 캠페인을 제공하는 파트너 정보
  //    */
  //   query
  //     .leftJoin('campaign.cate', 'cate', 'cate.idx = campaign.cateIdx')
  //     .leftJoin('campaign.cateArea', 'cateArea', 'cateArea.idx = campaign.cateAreaIdx')
  //     .leftJoin('campaign.campaignItem', 'campaignItem', 'campaignItem.campaignIdx = campaign.idx')
  //     .leftJoin(
  //       'campaignItem.campaignItemSchedule',
  //       'campaignItemSchedule',
  //       'campaignItemSchedule.itemIdx = campaignItem.idx',
  //     )
  //     .leftJoin('campaign.partner', 'partner', 'partner.idx = campaign.partnerIdx');
  //
  //   /**
  //    * 캠페인 상품 정보 중 가장 낮은 가격 및 결제 비율을 가진 상품 정보를
  //    * 가져오기 위한 서브쿼리 조인
  //    */
  //   query.leftJoin(
  //     (subQuery) => {
  //       return subQuery
  //         .select('ci2.campaignIdx', 'campaignIdx')
  //         .addSelect('MIN(ci2.priceOrig)', 'priceOrig')
  //         .addSelect('MIN(ci2.dc11)', 'dc11')
  //         .addSelect('ci2.memberTarget', 'memberTarget')
  //         .from(CampaignItem, 'ci2')
  //         .where('ci2.remove = 0')
  //         .groupBy('ci2.campaignIdx');
  //     },
  //     'ci2',
  //     'ci2.campaignIdx = campaign.idx',
  //   );
  //
  //   /**
  //    * 캠페인 이미지 중
  //    * 대표이미지의 경로를 가져오기 위한 서브쿼리 조인
  //    */
  //   query.leftJoin(
  //     (subQuery) => {
  //       return subQuery
  //         .select('ci.campaignIdx', 'campaignIdx')
  //         .addSelect('ci.aws_url', 'aws_url')
  //         .from(CampaignImage, 'ci')
  //         .where('ci.ordering = 1');
  //     },
  //     'ci',
  //     'ci.campaignIdx = campaign.idx',
  //   );
  //
  //   // SELECT 절에서 필요한 필드만 선택
  //   query.select([
  //     'campaign.idx as campaignIdx',
  //     'campaign.name as campaignName',
  //     'cate.name as categoryName',
  //     'cateArea.name as areaName',
  //     'campaign.approvalMethod as approvalMethod',
  //     'campaignItem.name as campaignItemName',
  //     'DATE(FROM_UNIXTIME(campaignItemSchedule.date)) as itemApplyDate',
  //     'campaignItemSchedule.stock as dailyStock',
  //     'ci2.priceOrig as lowestPriceOrig',
  //     'ci2.dc11 as influencerDiscountRate',
  //     'campaignItem.minDays as minStayDays',
  //     'campaignItem.maxDays as maxStayDays',
  //     'campaignItem.limitSubmit as maxApplyCount',
  //     'campaignItem.remove as isItemSoldOut',
  //     'campaign.grade as availableGrade',
  //     'ci2.memberTarget as targetCustomerGrade',
  //     'campaign.manuscriptFee as manuscriptFee',
  //     'campaign.remove as isCampaignSoldOut',
  //     'campaign.status as campaignStatus',
  //     'campaign.weight as exposureLevel',
  //     'campaign.approvalRate as approvalRate',
  //     'ci.aws_url as imagePath',
  //   ]);
  //
  //   return query;
  // }
  //
  // /**
  //  * 캠페인 쿼리에 기본 조건을 추가하는 함수
  //  * - remove: 캠페인 품절 여부
  //  * - status: 캠페인 상태 -> 상태에 대한 값이 코맨트로 지정되어 있으면 좋을 것 같음
  //  * - stock: 캠페인 상품 재고
  //  * @param query - 기본 캠페인 쿼리 객체
  //  * @param take - 가져올 결과 수
  //  */
  // baseWhereQuery(query) {
  //   query
  //     .where('campagin.remove = 0')
  //     .andWhere('campaign.status BETWEEN :startStatus AND :endStatus', { startStatus: '200', endStatus: '700' })
  //     .andWhere('campaignItemSchedule.stock > 0');
  // }
  //
  // /**
  //  * 캠페인 쿼리에 정렬 및 페이징 조건을 추가하는 함수
  //  * - weight: 캠페인 노출 가중치
  //  * @param query
  //  */
  // baseOrderAndLimitQuery(query, take) {
  //   query.orderBy('campaign.weight', 'DESC');
  //   query.orderBy('campaign.regdate', 'DESC');
  //   query.limit(take);
  // }
  //
  // /**
  //  * 필터 조건을 적용하여 쿼리를 수정하는 함수
  //  * 주어진 검색 조건에 따라 캠페인 데이터를 필터링
  //  * @param query - 기본 캠페인 쿼리 객체
  //  * @param filterSearch - `SearchCampaignDto`에서 제공하는 필터 조건 (startDate, endDate, limitSubmit, keyword)
  //  * @returns {SelectQueryBuilder} - 필터가 적용된 쿼리 빌더 객체
  //  */
  // async applySearchFilters(query, filterSearch, entityManager) {
  //   query.where('campaign.remove = 0');
  //
  //   console.log(`filterSearch.keyword: ${filterSearch.keyword}`);
  //   console.log(typeof filterSearch.keyword);
  //   // keyword가 있고, 빈 문자열이 아닌 경우에만 검색 조건 추가
  //   if (filterSearch.keyword) {
  //     // 검색어를 공백으로 분리하여 배열로 만듭니다.
  //     const keywords = filterSearch.keyword.split(' ').filter((word) => word.trim() !== '');
  //
  //     // 각 단어가 campaign.name, cateArea.name, campaignItem.name에 매칭되도록 조건 추가
  //     keywords.forEach((word, index) => {
  //       query.andWhere(
  //         `(
  //         (campaign.name LIKE :keyword${index})
  //         OR (cateArea.name LIKE :keyword${index})
  //         OR (campaignItem.name LIKE :keyword${index})
  //       )`,
  //         {
  //           [`keyword${index}`]: `%${word}%`,
  //         },
  //       );
  //     });
  //   }
  //
  //   // startDate와 endDate를 campaignItemSchedule의 date와 비교
  //   if (filterSearch.startDate && filterSearch.endDate) {
  //     const startDateUnix = Math.floor(new Date(filterSearch.startDate).getTime() / 1000);
  //     const endDateUnix = Math.floor(new Date(filterSearch.endDate).getTime() / 1000);
  //
  //     query.andWhere('campaignItemSchedule.date BETWEEN FROM_UNIXTIME(:startDate) AND FROM_UNIXTIME(:endDate)', {
  //       startDate: startDateUnix,
  //       endDate: endDateUnix,
  //     });
  //   }
  //
  //   if (filterSearch.grade && filterSearch.grade.length > 0) {
  //     if (!filterSearch.grade.includes('0')) {
  //       // 특정 grade가 선택된 경우
  //       query.andWhere('campaign.grade IN (:...grade)', { grade: filterSearch.grade });
  //     } else {
  //       // "전체 선택"이 선택된 경우
  //       // DB에서 모든 grade 값을 조회
  //       const allGrades = await entityManager
  //         .createQueryBuilder()
  //         .select('DISTINCT campaign.grade')
  //         .from('campaign', 'campaign')
  //         .getRawMany();
  //
  //       // 전체 grade 값을 배열로 변환
  //       const gradeArray = allGrades.map((item) => item.grade);
  //
  //       // 조회된 모든 grade 값을 사용해 필터링
  //       query.andWhere('campaign.grade IN (:...grade)', { grade: gradeArray });
  //     }
  //   }
  //
  //   if (filterSearch.limitSubmit) {
  //     query.andWhere(`campaignItem.limitSubmit >= ${filterSearch.limitSubmit}`);
  //   }
  //
  //   return query;
  // }
  //
  // /**
  //  * 검색 결과를 처리하고 페이징 정보를 반환하는 함수.
  //  * @param query - 실행할 쿼리 객체
  //  * @param take - 한 페이지당 가져올 결과 수
  //  * @param page - 현재 페이지 번호
  //  * @returns {Promise<Pagination>} - 페이지네이션 처리된 결과를 포함한 객체
  //  */
  // processSearchResults(query, take, page) {
  //   return query.getRawMany().then((data) => {
  //     let result = bufferToString(data);
  //
  //     result = Array.isArray(result) ? result : [result];
  //
  //     if (result.length === 0) return [];
  //
  //     result = result.map((item) => ({
  //       ...item,
  //       discountPrice: Math.round((item.lowestPriceOrig * item.discountPercentage) / 100),
  //     }));
  //
  //     return query.getCount().then((total) => {
  //       const totalPage = Math.ceil(total / take);
  //
  //       if (page > totalPage) {
  //         throw new NotFoundException('Page not found');
  //       }
  //
  //       return new Pagination({
  //         data: result,
  //         total,
  //         totalPage,
  //         currentPage: page,
  //       });
  //     });
  //   });
  // }
  //
  // /**
  //  * 검색 및 필터 조건을 함께 적용하여 캠페인 정보를 조회하는 함수.
  //  * @param take - 한 페이지당 가져올 결과 수
  //  * @param page - 현재 페이지 번호
  //  * @param filterSearch - 검색 필터 객체 (`SearchCampaignDto`)
  //  * @param filter - `SearchFilterCampaignDto`에서 제공하는 필터 조건
  //  * @returns {Promise<Pagination>} - 검색 및 필터가 적용된 캠페인 데이터와 페이지네이션 정보가 포함된 객체
  //  */
  // async getCampaignSearchWithFilter(take, page, filterSearch: SearchCampaignDto, filter: SearchFilterCampaignDto) {
  //   try {
  //     const query = this.createBaseCampaignQuery(this.campaignRepository);
  //     this.baseWhereQuery(query);
  //     await this.applySearchFilters(query, filterSearch, this.entityManager);
  //
  //     this.baseOrderAndLimitQuery(query, take);
  //
  //     // 결과 처리
  //     const response = await this.processSearchResults(query, take, page);
  //
  //     console.log(`response: ${JSON.stringify(response, null, 2)}`);
  //     return response;
  //   } catch (error) {
  //     console.error('Error in getCampaignWithSearchAndFilter:', error);
  //     throw new Error(error);
  //   }
  // }
}
