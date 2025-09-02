import {Resolver, Query, Mutation, Args} from '@nestjs/graphql';
import {MainModelService} from './main_model.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {Inject} from "@nestjs/common";
import {now} from "moment";

@Resolver('MainModel')
export class MainModelResolver {
    constructor(private readonly mainModelService: MainModelService,
                @Inject(CACHE_MANAGER) private cacheManager: Cache,) {
    }

    @Query(() => String)
    async getMainPage(
        @Args({name: 'sort', type: () => String}) sort: string,
    ) {
        try {
            if(!sort){
                sort = "regdate"
            }
            let key = sort;
            console.log("=>(main_model.resolver.ts:23) key", key);
            // let data = await this.cacheManager.get(key);
            // if (!data) {
            //     data = await this.mainModelService.getMainPage(sort);
            //     await this.cacheManager.set(key, data, 20000);
            // }
            let data = await this.mainModelService.getMainPage(sort);
            return data;
            // return await this.mainModelService.getMainPage(sort);
        } catch (error) {
            throw error;
        }
    }
}
