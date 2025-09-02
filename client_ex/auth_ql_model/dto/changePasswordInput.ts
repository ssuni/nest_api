import {Field, Int, ArgsType, InputType} from '@nestjs/graphql'

@InputType()
export class ChangePasswordInput {
    @Field()
    username: string;

    @Field()
    phone: string;

    @Field()
    password: string;

    // @Field()
    // id: string;
}
