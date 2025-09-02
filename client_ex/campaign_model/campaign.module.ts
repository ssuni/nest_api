import { Module } from '@nestjs/common';
import { CampaignResolver } from './campaign.resolver';
import {CampaignService} from "../../campaign/campaign.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Campaign} from "../../../entity/entities/Campaign";
import {JwtService} from "@nestjs/jwt";

@Module({
    imports: [TypeOrmModule.forFeature([Campaign])],
    providers: [CampaignResolver,CampaignService,JwtService],
})
export class CampaignGraphqlModule {}
