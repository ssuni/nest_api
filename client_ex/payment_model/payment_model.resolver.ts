import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';
import {PaymentModelService} from './payment_model.service';
import {SubmitModelService} from "../submit_model/submit_model.service";
import {MembersService} from "../member_model/member.service";
import {
    FROM_UNIXTIME_JS_PLUS,
    FROM_UNIXTIME_JS_YY_MM_DD,
    genSid,
    getAfter3Days, getBetweenDate,
    getBootpayStatusText,
    getUnixTimeStamp,
    getUnixTimeStampAfter3Days,
    getUnixTimeStampByDate, getUnixTimeStampByDate9,
    getUnixTimeStampByDate9Sub,
    getUnixTimeStampByYmdPlus,
} from '../../util/common';
import common_1, {HttpException, UseGuards} from "@nestjs/common";
import {GqlAuthGuard} from "../../auth/GqlAuthGuard";
import {AuthUser} from "../../auth/auth-user.decorator";
import {Member} from "../../../entity/entities/Member";
import {ApiplexService} from "../apiplex/apiplex.service";
import {CampaignService} from "../../campaign/campaign.service";
import {auth} from "firebase-admin";
import {Bootpay} from "@bootpay/backend-js";
import {Payment} from "../../../entity/entities/Payment";
import {Connection} from "typeorm";
import {CampaignSubmit} from "../../../entity/entities/CampaignSubmit";
import {EmailService} from "../../email/email.service";
import * as process from 'process';
import { CampaignItemSchedule } from '../../../entity/entities/CampaignItemSchedule';


class ConfirmPaymentInput {
    sid: string;
    receipt_id: string;
    itemIdx: number;
    price: number;
    nop: number;

}

class PaymentItemInput {
    receipt_id: string
    campaignIdx: number
    itemIdx: number
    nop: number
    startDate: string
    endDate: string
    price: number
    submitChannel: number
    agreeContent: number
    note: string
}

@Resolver('PaymentModel')
export class PaymentModelResolver {
    constructor(
        private readonly paymentModelService: PaymentModelService,
        private readonly submitModelService: SubmitModelService,
        private readonly apiPlexService: ApiplexService,
        private readonly membersService: MembersService,
        private readonly campaignsService: CampaignService,
        private readonly emailService: EmailService,
        private connection: Connection,
    ) {
        Bootpay.setConfiguration({
            application_id: process.env.BOOTPAY_APPLICATION_ID,
            private_key: process.env.BOOTPAY_PRIVATE_KEY,
        })
    }

    @Mutation()
    @UseGuards(GqlAuthGuard) //로그인 체크
    async paymentItem(
        @Args('paymentItemInput') paymentItemInput: PaymentItemInput,
        @AuthUser() authUser: Member
    ) {

        console.log("=>(payment_model.resolver.ts:58) paymentItemInput", paymentItemInput);
        const queryRunner = this.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const memberIdx = authUser.idx;
            const campaign = await this.campaignsService.getCampaign(paymentItemInput.campaignIdx);
            console.log("=>(payment_model.resolver.ts:59) campaign", campaign);
            const campaignItem = await this.campaignsService.getCampaignItemByIdx(paymentItemInput.itemIdx);
            console.log("=>(payment_model.resolver.ts:62) campaignItem", campaignItem);

            let checked = true;
            let sid = "";
            while (checked) {
                sid = genSid(paymentItemInput.itemIdx)
                const checkSid = await this.submitModelService.checkSid(sid)
                if (checkSid === 0) {
                    checked = false;
                }
            }
            console.log("=>(payment_model.resolver.ts:74) sid", sid);
            let pay = campaignItem.priceDeposit
            // const startDate = getUnixTimeStampByDate9Sub(paymentItemInput.startDate);
            // const endDate = getUnixTimeStampByDate9Sub(paymentItemInput.endDate);
            const startDate = getUnixTimeStampByDate(paymentItemInput.startDate);
            const endDate = getUnixTimeStampByDate(paymentItemInput.endDate? paymentItemInput.endDate : paymentItemInput.startDate);
            const nights = (endDate - startDate) / 86400;
            let finalPrice = paymentItemInput.price;
            pay = finalPrice;
            // if (campaignItem.minDays > 1) {
            //     let minDays = campaignItem.minDays - 1;
            //     //nights 를 minDays 로 나눠 개수
            //     let count = Math.floor(nights / minDays);
            //     pay = pay * count;
            // }else{
            //
            //     pay = finalPrice;
            // }

            //재고 체크
            console.log("=>(payment_model.resolver.ts:118) startDate", startDate);
            console.log("=>(payment_model.resolver.ts:119) endDate", endDate);
            const campaignItemSchdule = await this.submitModelService.getCampaignItemSchduleByItemIdxAndRangeDateString(
                paymentItemInput.itemIdx, paymentItemInput.startDate, paymentItemInput.endDate? paymentItemInput.endDate : paymentItemInput.startDate) // 신청 정보의 itemIdx와 startDate로 스케쥴 정보 가져오기

          if(nights > 1) {
            const betweenDays = getBetweenDate(startDate, endDate);
            console.log("=>(payment_model.resolver.ts:285) 연박체크 : campaignItemSchdule", campaignItemSchdule);
            console.log("=>(payment_model.resolver.ts:286) 연박체크 : betweenDays", betweenDays);
            if(betweenDays.length !== campaignItemSchdule.length){
              throw new HttpException("신청 가능한 스케쥴이 없습니다.", 404);
            }
          }

            let itemSchduleIdx = [];

            campaignItemSchdule.forEach((item) => {
                itemSchduleIdx.push(item.idx);
                if (item.stock == 0) {
                    throw new HttpException("재고가 부족합니다.", 404);
                }
            });
            console.log("=>(payment_model.resolver.ts:134) campaignItemSchdule", campaignItemSchdule);

            let inputData = {
                sid: String(sid),
                status: 100,
                memberType: 1,
                memberType2: 1,
                submitChannel: paymentItemInput.submitChannel,
                nights: nights,
                campaignIdx: paymentItemInput.campaignIdx,
                itemIdx: paymentItemInput.itemIdx,
                nop: paymentItemInput.nop,
                startDate: startDate,
                endDate: endDate,
                price: paymentItemInput.price,
                // type: createCampaignSubmitInput.type,
                memberIdx: authUser.idx,
                regdate: getUnixTimeStamp(),
                campaignName: campaign.name,
                itemName: campaignItem.name,
                payItem: pay,
                payTotal: pay,
                use_app: 'Y',
                agreeContent: paymentItemInput.agreeContent,
                note: paymentItemInput.note? paymentItemInput.note : '',
            }
            //createCampaignSubmit
            const insertSubmit = await queryRunner.manager.createQueryBuilder()
                .insert()
                .into(CampaignSubmit,[
                    "sid",
                    "status",
                    "memberType",
                    "memberType2",
                    "submitChannel",
                    "nights",
                    "campaignIdx",
                    "itemIdx",
                    "nop",
                    "startDate",
                    "endDate",
                    "price",
                    "memberIdx",
                    "regdate",
                    "campaignName",
                    "itemName",
                    "payItem",
                    "payTotal",
                    "use_app",
                    "agreeContent",
                    "note"
                ])
                .values(inputData)
                .execute();

            const submitIdx = insertSubmit.identifiers[0].idx
            console.log("=>(payment_model.resolver.ts:109) submitIdx", submitIdx);

            const submitItem = await this.submitModelService.getSubmitBySid(sid) //sid로 신청 정보 가져오기
            console.log("=>(payment_model.resolver.ts:151) submitItem", submitItem);

            await Bootpay.getAccessToken()
            const response = await Bootpay.confirmPayment(paymentItemInput.receipt_id)
            console.log("=>(payment_model.service.ts:19) confirmPayment", response);
// const response = {
//     status : 1,
//     order_id : "123456",
//     price : pay,
//     receipt_id : "123456",
//     method_origin_symbol : "card",
//     purchased_at : getUnixTimeStamp(),
//     card_data : {
//         card_company : "신한카드",
//         card_no : "1234-5678-1234-5678"
//     }
//
// }

            if (response.status === 1) {
                console.log("-> response", response);

                if ((pay) != response.price) {
                    //cancelPayment
                    await this.paymentModelService.cancelPayment(response.receipt_id);
                    throw new HttpException("결제 금액이 일치하지 않습니다.", 404);
                }
                const purchasedAt = new Date(response.purchased_at);
                //payment insert
                const payment = await queryRunner.manager.createQueryBuilder()
                    .insert()
                    .into(Payment,[
                        "status",
                        "oid",
                        "memberIdx",
                        "submitIdx",
                        "payTotal",
                        "receiptId",
                        "payMethod",
                        "regdate",
                        "paydate",
                        "cardName",
                        "cardNum"
                    ])
                    .values({
                        status: response.status == 1 ? 200 : 100,
                        oid: response.order_id,
                        memberIdx: memberIdx,
                        submitIdx: submitIdx,
                        payTotal: response.price,
                        receiptId: response.receipt_id,
                        payMethod: response.method_origin_symbol,
                        regdate: getUnixTimeStamp(),
                        // paydate: getUnixTimeStampByDate(response.purchased_at.toString()),
                        paydate: response.purchased_at ? purchasedAt.getTime() : null,
                        cardName: response.card_data ? response.card_data.card_company : '',
                        cardNum: response.card_data ? response.card_data.card_no : '',
                    })
                    .execute();

                //campaignSubmit paymentIdx status = 300 update
                  const updateSubmit = await queryRunner.manager.createQueryBuilder()
                        .update(CampaignSubmit)
                        .set({
                            status: 300,
                            paymentIdx: payment.identifiers[0].idx
                        })
                        .where("idx = :idx", {idx: submitIdx})
                        .execute();

                //재고 차감
                campaignItemSchdule.forEach((item) => {
                    itemSchduleIdx.push(item.idx);
                    if (item.stock == 0) {
                        throw new HttpException("재고가 부족합니다.", 404);
                    }
                });
                if (itemSchduleIdx.length > 0) {
                    let count: any;
                    if (campaignItem.calcType1 == 1) {
                        count = nights;
                    } else {
                        count = paymentItemInput.nop;
                    }
                    //재고 차감
                    let campaignItemSchduleUpdate = await queryRunner.manager.createQueryBuilder()
                      .update(CampaignItemSchedule)
                      .set({
                          stock: () => 'stock - ' + count,
                      })
                      .where('idx IN (:...idx)', { idx: itemSchduleIdx })
                      .execute();
                    // const result = await this.submitModelService.updateCampaignItemSchduleStock(
                    //     itemSchduleIdx,
                    //     count,
                    //     sid,
                    //     response,
                    //     // 12328, // memberIdx0114
                    //     authUser.idx, // memberIdx
                    //     campaignItem.idx
                    // )
                }
                await queryRunner.commitTransaction();

                //Todo 파트너 알림톡
                const member = await this.membersService.getMember(authUser.idx);
                const campaign = await this.submitModelService.getCampaignByCampaignIdx(paymentItemInput.campaignIdx);
                const partner = await this.submitModelService.getPartnerByPartnerIdx(campaign.partnerIdx);
                const cannelData = await this.membersService.getCannelLinkByUserIdx(paymentItemInput.submitChannel, authUser.idx);
                let param = {
                    "이름": member.name ? member.name : "회원",
                    "캠페인이름": campaign.name,
                    "업체이름": partner.corpName,
                    "이용일자": FROM_UNIXTIME_JS_PLUS(startDate) + ' ~ ' + FROM_UNIXTIME_JS_PLUS(endDate),
                    "인원": paymentItemInput.nop,
                    "채널주소": cannelData['link'],
                }
console.log("=>(payment_model.resolver.ts:232) 구매제 알림톡 param : ", param);
                    await this.apiPlexService.sendUserAlimtalk('A15Ddgjt0fag', authUser.phone, param);
                    await this.apiPlexService.sendPartnerAlimtalk('ghkf92y98dkj', param, paymentItemInput.campaignIdx);
                    await this.emailService.partnerEmail('ghkf92y98dkj', param, campaign.partnerIdx, paymentItemInput.campaignIdx);

                return {
                    status: response.status,
                    code: 200,
                    message: getBootpayStatusText(response.status),
                    data: response
                }
            }

        } catch (error) {
            console.log("=>(payment_model.resolver.ts:106) error", error);
            await queryRunner.rollbackTransaction();
            await this.paymentModelService.cancelPayment(paymentItemInput.receipt_id);
            //db lock 해제

            throw new HttpException(error.message, error.error_code);
        } finally {
            await queryRunner.release();
        }
    }


    @Mutation()
    @UseGuards(GqlAuthGuard) //로그인 체크
    async confirmStock(
        @Args('confirmPaymentInput') confirmPaymentInput: ConfirmPaymentInput,
        @AuthUser() authUser: Member
    ) {

        console.log("=>(payment_model.resolver.ts:34) confirmPaymentInput.sid", confirmPaymentInput.sid);
        console.log("=>(payment_model.resolver.ts:36) confirmStock 유저정보 : ", authUser);
        try {
            const submitItem = await this.submitModelService.getSubmitBySid(confirmPaymentInput.sid) //sid로 신청 정보 가져오기
            console.log("=>(payment_model.resolver.ts:265) 승인정보 => ", submitItem);

            if (!submitItem) { //신청 정보가 없을 경우
                throw new HttpException("신청 정보가 존재하지 않습니다.", 404);
            }

            const campaignItemSchdule = await this.submitModelService.getCampaignItemSchduleByItemIdxAndRangeDate(
                submitItem.itemIdx, submitItem.startDate, submitItem.endDate) // 신청 정보의 itemIdx와 startDate로 스케쥴 정보 가져오기


            console.log("=>(payment_model.resolver.ts:355) campaignItemSchdule", campaignItemSchdule);
            const campaignItemCalcType = await this.campaignsService.getCampaignItemCalcType(submitItem.itemIdx);

             if (campaignItemSchdule.length == 0) {
                 throw new HttpException("신청 가능한 스케쥴이 없습니다.", 404);
             }

            //연박 체크
            const nights = (submitItem.endDate - submitItem.startDate) / 86400;
            if(nights > 1) {
                const betweenDays = getBetweenDate(submitItem.startDate, submitItem.endDate);
                console.log("=>(payment_model.resolver.ts:285) 연박체크 : campaignItemSchdule", campaignItemSchdule);
                console.log("=>(payment_model.resolver.ts:286) 연박체크 : betweenDays", betweenDays);
                if(betweenDays.length !== campaignItemSchdule.length){
                    throw new HttpException("신청 가능한 스케쥴이 없습니다.", 404);
                }
            }

            let itemSchduleIdx = [];
            campaignItemSchdule.forEach((item) => {
                // stock 확인 nop > stock
                itemSchduleIdx.push(item.idx);

                let count: any;
                if (campaignItemCalcType.calcType1 == 1) {
                    count = 1;
                } else {
                    count = submitItem.nop;
                }
                console.log("=>(payment_model.resolver.ts:292)  재고 카운트 item.stock => ", item.stock );
                console.log("=>(payment_model.resolver.ts:292)  재고 카운트  => ", count);

                if (item.stock == 0) {
                    throw new HttpException("재고가 부족합니다.", 404);
                }
                if(item.stock-count < 0){
                    throw new HttpException("재고가 부족합니다.", 404);
                }
            })
            //재고 체크후 결제 confirm
            // authUser.idx set
            let memberIdx = authUser ? authUser.idx : 0;
            if (memberIdx == 0) {
                throw new HttpException("로그인이 필요합니다.", 404);
            }

            // const response = await this.paymentModelService.confirmPayment(confirmPaymentInput, memberIdx);
            // console.log("=>(payment_model.resolver.ts:53) confirmPayment response", response);

            await Bootpay.getAccessToken()
            const response = await Bootpay.confirmPayment(confirmPaymentInput.receipt_id)
            console.log("=>(payment_model.resolver.ts:403) confirmPayment response", response);
            if(response.status === 1){
                console.log("-> ************************** response", response.status);
            }
console.log("=>(payment_model.resolver.ts:407) itemSchduleIdx", itemSchduleIdx);
            //가상계좌
            if (response.method_symbol === 'vbank') {
                //payment insert transaction
                const vbankDataTransaction = await this.paymentModelService.vbankDataTransaction(response, submitItem, memberIdx);
                console.log("=>(payment_model.resolver.ts:68) vbankDataTransaction", vbankDataTransaction);

                if (authUser.phone) {
                    const campaign = await this.submitModelService.getCampaignByCampaignIdx(submitItem.campaignIdx);
                    const partner = await this.submitModelService.getPartnerByPartnerIdx(campaign.partnerIdx);
                    //Todo apiplex 가상계좌
                    const member = await this.membersService.getMember(authUser.idx);
                    let param = {
                        // "이름": authUser.username ? authUser.username : "회원",
                        "이름": member.name ? member.name : "회원",
                        "가상계좌은행": response.vbank_data.bank_name,
                        "가상계좌번호": response.vbank_data.bank_account,
                        "캠페인이름": campaign.name,
                        "업체이름": partner.corpName,
                        //YYYY-MM-DD 이용일자
                        "이용일자": FROM_UNIXTIME_JS_PLUS(submitItem.startDate) + ' ~ ' + FROM_UNIXTIME_JS_PLUS(submitItem.endDate),
                        "인원": submitItem.nop,
                        "입금액": response.price,
                        "캠페인페이지승인링크": 'https://wairi.co.kr/extranet/campaign/submit#/' + submitItem.idx,
                    }

                    await this.apiPlexService.sendUserAlimtalk('UOs0AyzcEtMt', authUser.phone, param);
                }

                if (vbankDataTransaction) {
                    return {
                        status: response.status,
                        code: 200,
                        message: "가상계좌 발급이 완료되었습니다.",
                        data: response
                    }
                }
            }

            console.log("=>(payment_model.resolver.ts:86) 결제  response : ", response);

            if (response.status === 1) {

                if ((submitItem.payTotal) != response.price) {
                    //cancelPayment
                    await this.paymentModelService.cancelPayment(response.receipt_id);
                    throw new HttpException("결제 금액이 일치하지 않습니다.", 404);
                }


                //재고 차감
                if (itemSchduleIdx.length > 0) {
                      let count: any;
                      if (campaignItemCalcType.calcType1 == 1) {
                          count = 1;
                      } else {
                          count = submitItem.nop;
                      }
                      console.log("=>(payment_model.resolver.ts:101) updateCampaignItemSchduleStock", '카드사용 재고차감 시작');
                      const result = await this.submitModelService.updateCampaignItemSchduleStock(
                          itemSchduleIdx,
                          count,
                          confirmPaymentInput.sid,
                          response,
                          // 12328, // memberIdx0114
                          memberIdx, // memberIdx
                          submitItem.idx
                      )
    //                }

                  //Todo 파트너 알림톡
                  const member = await this.membersService.getMember(authUser.idx);
                  const campaign = await this.submitModelService.getCampaignByCampaignIdx(submitItem.campaignIdx);
                  const partner = await this.submitModelService.getPartnerByPartnerIdx(campaign.partnerIdx);
                  const cannelData = await this.membersService.getCannelLinkByUserIdx(submitItem.submitChannel, authUser.idx);
                  let param = {
                      "이름": member.name ? member.name : "회원",
                      "캠페인이름": campaign.name,
                      "업체이름": partner.corpName,
                      "이용일자": FROM_UNIXTIME_JS_PLUS(submitItem.startDate) + ' ~ ' + FROM_UNIXTIME_JS_PLUS(submitItem.endDate),
                      "인원": submitItem.nop,
                      "채널주소": cannelData['link'],
                  }

                      await this.apiPlexService.sendUserAlimtalk('18memDED3j3V', authUser.phone, param);
                      await this.apiPlexService.sendPartnerAlimtalk('10jios36HB30', param, submitItem.campaignIdx);
                      await this.emailService.partnerEmail('10jios36HB30', param, partner.idx, campaign.idx);
              }else{
                  await this.paymentModelService.cancelPayment(response.receipt_id);
              }

            }

            return {
                status: response.status,
                code: 200,
                message: getBootpayStatusText(response.status),
                data: response
            }
        } catch (error) {
            console.log("=>(payment_model.resolver.ts:391) error", error);
            throw new HttpException(error.message, error.error_code);
        }
    }

    @Query()
    async cancelPayment(
        @Args('receipt_id', {type: () => String}) receipt_id: String,
    ) {
        try {
            const response = await this.paymentModelService.cancelPayment(receipt_id);
            console.log(getBootpayStatusText(response.status))
            return response;
        } catch (error) {
            console.log(error)
            throw error;
        }
    }
}
