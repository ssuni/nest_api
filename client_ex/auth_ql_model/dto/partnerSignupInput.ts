import {Field, Int, ArgsType, InputType} from '@nestjs/graphql'
import {IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Length, validate} from 'class-validator';


@ArgsType()
export class PartnerSignupInput {
    @Field()
    @IsNotEmpty({message:'아이디를 입력해주세요'})
    id: string;

    @Field()
    @IsNotEmpty({message:'비밀번호를 입력해주세요'})
    password: string;

    @Field()
    corpName: string;

    @Field()
    corpCeo: string;

    @Field()
    corpTel: string;

    @Field()
    attachBiz: string;

    @Field()
    contactName: string;

    @Field()
    contactPhone: string;

    @Field()
    contactEmail: string;
}