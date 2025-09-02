import {Field, Int, ArgsType, InputType} from '@nestjs/graphql'
import {IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Length, validate} from 'class-validator';

@ArgsType()
export class SignupInput {
    @Field()
    @IsNotEmpty({message:'아이디를 입력해주세요'})
    id: string;

    @Field()
    @IsNotEmpty({message:'비밀번호를 입력해주세요'})
    password: string;

    // @Field()
    // @IsNotEmpty({message:'닉네임을 입력해주세요'})
    // nickname: string;

    // @Field()
    // @IsNotEmpty({message:'핸드폰번호를 입력해주세요'})
    // @IsPhoneNumber('KR', {message:'핸드폰번호 형식이 잘못 되었습니다.'})
    // phone: string;
    //
    @Field()
    @IsNotEmpty({message:'이메일을 입력해주세요'})
    @IsEmail( {}, {message:'이메일 형식이 잘못 되었습니다.'})
    email: string;
    //
    // @Field()
    // receipt_id: string;
    //
    // @Field()
    // name: string;

    @Field()
    type: number;

    // @Field()
    // unique: string;
    //
    // @Field()
    // di: string;
    //
    // @Field()
    // birth: number;
    //
    // @Field()
    // gender: number;
    //
    // @Field()
    // channelType: number;
    //
    // @Field()
    // link: string;

    @Field()
    refererRoot: number;

    @Field()
    refererRootInput: string;

    @Field()
    agree: number;

}

