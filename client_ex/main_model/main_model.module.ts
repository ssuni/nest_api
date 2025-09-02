import {Module} from '@nestjs/common';
import {MainModelService} from './main_model.service';
import {MainModelResolver} from './main_model.resolver';
import {BannerModelService} from "../banner_model/banner_model.service";
import {CateModelService} from "../cate_model/cate_model.service";
import {CampaignService} from "../campaign_model/campaign_model.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Banner} from "../../../entity/entities/Banner";
import {Cate} from "../../../entity/entities/Cate";
import {CateArea} from "../../../entity/entities/CateArea";
import {Campaign} from "../../../entity/entities/Campaign";
import {CampaignItem} from "../../../entity/entities/CampaignItem";
import {CampaignItemSchedule} from "../../../entity/entities/CampaignItemSchedule";
import {CampaignSubmit} from "../../../entity/entities/CampaignSubmit";
import {Popup} from "../../../entity/entities/Popup";
import {CacheModule} from "@nestjs/cache-manager";


@Module({
    imports: [
        TypeOrmModule.forFeature([Banner, Cate, CateArea, Campaign,
            CampaignItem,CampaignItemSchedule,CampaignSubmit, Popup
        ]),
        CacheModule.register()
    ],
    providers: [MainModelResolver, MainModelService, BannerModelService, CateModelService,
        CampaignService]
})
export class MainModelModule {
}
