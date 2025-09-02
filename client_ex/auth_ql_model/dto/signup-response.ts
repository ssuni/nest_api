import {Field,ObjectType} from "@nestjs/graphql";
import {Member} from "../../../../entity/entities/Member";

@ObjectType()
export class SignupResponse {
    @Field()
    message: string;

    @Field()
    data: Member;
}