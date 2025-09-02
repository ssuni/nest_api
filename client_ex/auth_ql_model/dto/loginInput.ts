import {Field, Int, ArgsType, InputType} from '@nestjs/graphql'

@InputType()
export class LoginInput {
    @Field()
    id: string;

    @Field()
    password: string;
}