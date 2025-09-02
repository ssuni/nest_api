import {Field,ObjectType} from "@nestjs/graphql";
import {Member} from "../../../../entity/entities/Member";

@ObjectType()
export class LoginResponse {
    @Field()
    message: string;

    @Field()
    access_token?: string;

    @Field()
    refresh_token?: string;

    @Field(()=>Member, { nullable: true })
    member?: Member;
}