import {HttpException, Injectable} from '@nestjs/common';
import {Bootpay} from "@bootpay/backend-js";
import * as process from 'process';
import {ReceiptResponseParameters} from "@bootpay/backend-js";
import {getUnixTimeStamp} from "../../util/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Payment} from "../../../entity/entities/Payment";
import {CampaignItemSchedule} from "../../../entity/entities/CampaignItemSchedule";
import {Brackets, Connection, Repository} from "typeorm";
import {CampaignSubmit} from "../../../entity/entities/CampaignSubmit";
@Injectable()
export class PaymentModelService {
    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(CampaignItemSchedule)
        private readonly campaignItemScheduleRepository: Repository<CampaignItemSchedule>,
        private connection: Connection,
    ) {
        Bootpay.setConfiguration({
            application_id: process.env.BOOTPAY_APPLICATION_ID,
            private_key: process.env.BOOTPAY_PRIVATE_KEY,
        })
    }

    async confirmPayment(confirmPaymentInput, memberIdx) {
        try {
            const {sid, receipt_id, itemIdx, price, nop} = confirmPaymentInput

            await Bootpay.getAccessToken()
            const response = await Bootpay.confirmPayment(receipt_id)
            console.log("=>(payment_model.service.ts:19) confirmPayment", response);
            if(response.status === 1){
                console.log("-> response", response.status);
            }
            return response
        } catch (e) {
            // 발급 실패시 오류
            console.log("=>confirmPayment response",e);
            throw new HttpException(e.message, e.status);
        }
    }

    async cancelPayment(receipt_id) {
        try {
            await Bootpay.getAccessToken()
            const response = await Bootpay.cancelPayment(
                {
                    receipt_id: receipt_id,
                }
            )
            console.log("-> response", response);
            return response
        } catch (e) {
            // 발급 실패시 오류
            console.log(e)
        }
    }

    async vbankDataTransaction(response: ReceiptResponseParameters, submitItem: any, memberIdx: number) {
        //Transaction
        const queryRunner = this.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            // unixtime으로 변환
            const expireDate = new Date(response.vbank_data.expired_at)
            expireDate.setHours(expireDate.getHours() + 9) // +9시간
            const expireUnix = Math.floor(expireDate.getTime() / 1000) // unixtime

            // payment table insert
            const payment = await queryRunner.manager.createQueryBuilder()
                .insert()
                .into(Payment)
                .values({
                    status: response.status == 1? 200 : 100,
                    oid: response.order_id,
                    memberIdx: memberIdx,
                    submitIdx: submitItem.idx,
                    payTotal: response.price,
                    receiptId: response.receipt_id,
                    payMethod: response.method_origin_symbol,
                    regdate: getUnixTimeStamp(),
                    cardName: response.card_data? response.card_data.card_company : '',
                    cardNum: response.card_data? response.card_data.card_no : '',
                    vbankCode: response.vbank_data? response.vbank_data.bank_code : '',
                    vbankNum: response.vbank_data? response.vbank_data.bank_account : '',
                    vbankExpire: response.vbank_data? expireUnix : 0,
                })
                .execute();

            let paymentId = payment.raw.insertId; // get payment insertId
            console.log("=>(payment_model.service.ts:64) payment 테이블 idx: ", paymentId);

            //update submit.paymentIdx = payment.insertId
            const submitUpdate = await queryRunner.manager.createQueryBuilder()
                .update(CampaignSubmit)
                .set({
                    paymentIdx: paymentId,
                })
                .where("idx = :idx", {idx: submitItem.idx})
                .execute();

            // 캠페인 스케쥴에서 재고 확인
            const campaignItemSchdule = await this.campaignItemScheduleRepository.createQueryBuilder("campaignItemSchedule")
                .select('*')
                .where("campaignItemSchedule.itemIdx = :itemIdx", {itemIdx: submitItem.itemIdx})
                .andWhere(new Brackets(qb => {
                    qb.where("campaignItemSchedule.date >= :startDate", {startDate: submitItem.startDate})
                        .andWhere("campaignItemSchedule.date <= :endDate", {endDate: submitItem.endDate});
                }))
                .getRawMany();
            console.log("=>(payment_model.service.ts:102) 스케쥴 재고 목록: ", campaignItemSchdule);

            let itemSchduleIdx = [];
            campaignItemSchdule.forEach((item) => {
                // stock 확인 nop > stock
                if (item.stock == 0) {
                    throw new HttpException("재고가 부족합니다.", 404);
                }
                itemSchduleIdx.push(item.idx);
            })
            console.log("=>(payment_model.service.ts:113) 스케쥴 아이템 번호: ", itemSchduleIdx);
            console.log("=>(payment_model.service.ts:123) response", response);
            //재고 차감
            if (itemSchduleIdx.length > 0 && response.status == 5) {
                if((submitItem.payTotal) != response.price){
                    throw new HttpException("결제 금액이 일치하지 않습니다.", 404);
                }
                // update campaign_item_schedule.stock = campaign_item_schedule.stock - 1
                await queryRunner.manager.createQueryBuilder()
                    .update(CampaignItemSchedule)
                    .set({
                        stock: () => `stock - 1`
                    })
                    .where("idx IN (:...idx)", {idx: itemSchduleIdx})
                    .execute();

                await queryRunner.commitTransaction();
                return response
            }
        } catch (e) {
            console.log("=>(payment_model.service.ts:137 vbankDataTransaction ) ", e);
            await queryRunner.rollbackTransaction();
            throw new HttpException("가상계좌 발급이 실패하였습니다.", 404);
        } finally {
            await queryRunner.release();
        }
    }

    async insertVbankPayment(response: ReceiptResponseParameters, submitIdx:number, memberIdx: number) {
        try{
            // 2023-11-02T18:42:59+09:00  unixtime으로 변환
            const expireDate = new Date(response.vbank_data.expired_at)
            // +9시간
            expireDate.setHours(expireDate.getHours() + 9)
            //unixtime
            const expireUnix = Math.floor(expireDate.getTime() / 1000)

            const insertData = {
                status: response.status == 1? 200 : 100,
                oid: response.order_id,
                memberIdx: memberIdx,
                submitIdx: submitIdx,
                payTotal: response.price,
                receiptId: response.receipt_id,
                payMethod: response.method_origin_symbol,
                regdate: getUnixTimeStamp(),
                cardName: response.card_data? response.card_data.card_company : '',
                cardNum: response.card_data? response.card_data.card_no : '',
                vbankCode: response.vbank_data? response.vbank_data.bank_code : '',
                vbankNum: response.vbank_data? response.vbank_data.bank_account : '',
                vbankExpire: response.vbank_data? expireUnix : 0,
            }

            const payment = this.paymentRepository.createQueryBuilder()
                .insert()
                .into(Payment)
                .values(insertData)
                .execute();

            if (payment) {
                return payment;
            }

        }catch (e) {
            console.log(e)
        }

    }
}
