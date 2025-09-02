import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CampaignService } from '../../campaign/campaign.service';
import { HttpException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/GqlAuthGuard';
import { bufferToString, FROM_UNIXTIME_JS } from '../../util/common';
import { FavInput } from './dto/favInput';
import { AuthUser } from '../../auth/auth-user.decorator';
import { Member } from '../../../entity/entities/Member';
import { SearchFilterCampaignDto } from '../../campaign/dto/search-filter-campaign.dto';
import { SearchCampaignDto } from '../../campaign/dto/search-campaign.dto';

@Resolver('Campaign')
export class CampaignResolver {
  constructor(private readonly campaignsService: CampaignService) {}

  @Query()
  async getActivateCampaign(
    @Args('keyword', { type: () => String }) keyword: string,
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('cate', { type: () => Int }) cate: number,
    @Args('cateArea', { type: () => Int }) cateArea: number,
    @Args('start', { type: () => Int }) start: string,
    @Args('end', { type: () => Int }) end: string,
    @Args('sort', { type: () => Int }) sort: number,
  ) {
    try {
      const data = await this.campaignsService.getActivateCampaign(
        keyword,
        take,
        page,
        cate,
        cateArea,
        start,
        end,
        sort,
      );
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getRecommendedSearchWords(
    @Args('type', { type: () => String }) type: string,
    @Args('limit', { type: () => Int }) limit: number,
  ) {
    try {
      const data = await this.campaignsService.getRecommendedSearchWords(type, limit);
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async search(
    @Args('keyword', { type: () => String }) keyword: string,
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
  ) {
    try {
      console.log(`let's try!`);
      const data = await this.campaignsService.search(keyword, take, page);
      console.log(`data: ${data}`);
      //json 형식으로 변환

      // console.log(data)
      // console.log(bufferToString(data))
      // data.forEach((element) => {
      //     bufferToString(element);
      // });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getCampaign(@Args('id', { type: () => Int }) id: number) {
    try {
      const data = await this.campaignsService.detailCampaign(id);
      //json 형식으로 변환
      // console.log(bufferToString(data))
      // data.forEach((element) => {
      //     bufferToString(element);
      // });
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  // @UseGuards(GqlAuthGuard)
  async getCampaigns(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('cate', { type: () => Int }) cate?: number,
    @Args('cateArea', { type: () => Int }) cateArea?: number,
    @Args('sort', { type: () => Int }) sort?: string,
  ) {
    try {
      // const list = await this.campaignsService.mainList(take, page, cate, cateArea, sort);
      const list = await this.campaignsService.getCampaigns(take, page, cate, cateArea);
      return list;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getCampaignsForRenewal(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('filter', { type: () => SearchFilterCampaignDto, nullable: true }) filter?: SearchFilterCampaignDto,
  ) {
    try {
      // return await this.campaignsService.getCampaignWithFilter(take, page, filter);
      return 0;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getCampaignsSearchForRenewal(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('filterSearch', { type: () => SearchCampaignDto, nullable: true }) filterSearch?: SearchCampaignDto,
  ) {
    try {
      return await this.campaignsService.getCampaignSearchWithFilter(take, page, filterSearch);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getCampaignsSearchWithFilter(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('filterSearch', { type: () => SearchCampaignDto, nullable: true }) filterSearch?: SearchCampaignDto,
    @Args('filter', { type: () => SearchFilterCampaignDto, nullable: true }) filter?: SearchFilterCampaignDto,
  ) {
    try {
      return await this.campaignsService.getCampaignSearchWithFilter(take, page, filterSearch, filter);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getFavCampaigns(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @AuthUser() authUser: Member,
  ) {
    try {
      const list = await this.campaignsService.favList(take, page, authUser.idx);
      return list;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  @Query()
  async getDetailCampaign(@Args('idx', { type: () => Int }) idx: number) {
    console.log('=>(campaign.resolver.ts:115) idx', idx);
    try {
      const data = await this.campaignsService.detailCampaign(idx);
      return data;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  @Query()
  async getCampaignItem(@Args('idx', { type: () => Int }) idx: number) {
    try {
      console.log(idx);
      const data = await this.campaignsService.detailCampaign(idx);
      //json 형식으로 변환
      return data.campaignItem;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  @Query()
  async getItemSchedule(
    @Args('idx', { type: () => Int }) idx: number,
    @Args('start_day', { type: () => String }) start_day: string,
    @Args('end_day', { type: () => String }) end_day: string,
  ) {
    try {
      const data = await this.campaignsService.getItemSchedule(idx, start_day, end_day);
      return data;
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  @Query()
  async getActiveItemSchedule(
    @Args('idx', { type: () => Int }) idx: number,
    @Args('start_day', { type: () => String }) start_day: string,
    @Args('end_day', { type: () => String }) end_day: string,
  ) {
    try {
      //현제시간 YYYY-MM-DD HH:mm:ss
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      //유닉스 타임스템프
      const nowUnix = Math.floor(new Date().getTime() / 1000);
      const startUnix = Math.floor(new Date(start_day).getTime() / 1000);
      const endUnix = Math.floor(new Date(end_day).getTime() / 1000);

      let data = await this.campaignsService.getActiveItemSchedule(idx, startUnix, endUnix, nowUnix);
      data = bufferToString(data);
      // console.log("=>(campaign.resolver.ts:166) data", data);
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMember(@Args('id', { type: () => Int }) id: number) {
    try {
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMemberByEmail(@Args('email', { type: () => String }) email: string) {
    try {
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getCampaignRecent(
    @Args('take', { type: () => Int }) take: number,
    @Args('page', { type: () => Int }) page: number,
    @Args('memberIdx', { type: () => Int }) memberIdx: number,
  ) {
    try {
      const list = await this.campaignsService.recentList(take, page, memberIdx);
      //json 형식으로 변환
      return list;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Mutation()
  @UseGuards(GqlAuthGuard)
  async setCampaignFav(@Args('favInput') favInput: FavInput, @AuthUser() authUser: Member) {
    try {
      const result = {
        idx: null,
        memberIdx: null,
        campaignIdx: null,
        regdate: null,
      };
      const response = await this.campaignsService.setCampaignFav(authUser.idx, favInput.campaignIdx);

      result.idx = response.idx;
      result.memberIdx = response.memberIdx;
      result.campaignIdx = response.campaignIdx;
      result.regdate = FROM_UNIXTIME_JS(response.regdate);

      return result;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Mutation()
  @UseGuards(GqlAuthGuard)
  async delCampaignFav(@Args('favInput') favInput: FavInput, @AuthUser() authUser: Member) {
    console.log('=>(campaign.resolver.ts:230) authUser', authUser);
    try {
      const result = {
        idx: null,
        memberIdx: null,
        campaignIdx: null,
        regdate: null,
      };
      const response = await this.campaignsService.delCampaignFav(authUser.idx, favInput.campaignIdx);

      if (response.affected === 0) {
        throw new Error('삭제 실패');
      }

      return {
        code: 200,
        message: '삭제 성공',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getCampaignSchedule(@Args('idx', { type: () => Int }) idx: number) {
    try {
      const data = await this.campaignsService.getCampaignSchedule(idx);
      // console.log("=>(campaign.resolver.ts:226) data", data);
      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query()
  async getCampaignItemSchedule(@Args('idx', { type: () => Int }) idx: number) {
    try {
      const data = await this.campaignsService.getCampaignItemSchedule(idx);

      return data;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
