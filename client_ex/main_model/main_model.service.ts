import {Injectable} from '@nestjs/common';
import {BannerModelService} from '../banner_model/banner_model.service';
import {CateModelService} from '../cate_model/cate_model.service';
import {CampaignService} from '../campaign_model/campaign_model.service';


@Injectable()
export class MainModelService {

    constructor(
        private bannerModelService: BannerModelService,
        private cateModelService: CateModelService,
        private campaignService: CampaignService
    ) {
    }

    async getMainPage(sort: string) {
        try {
            const banner = await this.bannerModelService.getBanner();
            const categories = await this.cateModelService.getCategories();
            const products = await this.campaignService.getProducts(sort);
            const result = {
                banner,
                categories,
                products
            }
            return result;

        } catch (error) {
            throw error;
        }
    }
}
