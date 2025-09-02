import {Field, Int, ArgsType, InputType} from '@nestjs/graphql'

@InputType()
export class FavInput {
    // @Field()
    // memberIdx: number;

    @Field()
    campaignIdx: number;
}
