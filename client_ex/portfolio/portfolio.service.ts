import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import { OcrService } from '../ocr/ocr.service';
import { PortfolioNaver } from '../../../entity/entities/PortfolioNaver';
import { PortfolioInstagram } from '../../../entity/entities/PortfolioInstagram';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PortfolioYoutube } from '../../../entity/entities/PortfolioYoutube';
import { bufferToString, iosDateToYYMMDD } from '../../util/common';
import { Pagination } from '../../paginate';
import { CampaignSubmit } from '../../../entity/entities/CampaignSubmit';
import { BlogAnalysis } from '../../../entity/entities/BlogAnalysis';
import { InstagramAnalysis } from '../../../entity/entities/InstagramAnalysis';
import { YoutubeAnalysis } from '../../../entity/entities/YoutubeAnalysis';
import { MemberProfile } from '../../../entity/entities/MemberProfile';
import { Member } from '../../../entity/entities/Member';
import { MembersService } from '../member_model/member.service';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly ocrService: OcrService,
    private readonly memberService: MembersService,
    @InjectRepository(PortfolioNaver)
    private readonly portfolioNaverRepository: Repository<PortfolioNaver>,
    @InjectRepository(PortfolioInstagram)
    private readonly portfolioInstagramRepository: Repository<PortfolioInstagram>,
    @InjectRepository(PortfolioYoutube)
    private readonly portfolioYoutubeRepository: Repository<PortfolioYoutube>,
    @InjectRepository(CampaignSubmit)
    private readonly campaignSubmitRepository: Repository<CampaignSubmit>,
    @InjectRepository(BlogAnalysis)
    private readonly blogAnalysisRepository: Repository<BlogAnalysis>,
    @InjectRepository(InstagramAnalysis)
    private readonly instagramAnalysisRepository: Repository<InstagramAnalysis>,
    @InjectRepository(YoutubeAnalysis)
    private readonly youtubeAnalysisRepository: Repository<YoutubeAnalysis>,
    @InjectRepository(MemberProfile)
    private readonly memberProfileRepository: Repository<MemberProfile>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {
  }

  async createPortfolio(authUser: any, createInput: any, thumbnail: any, file1: any, file2: any): Promise<Promise<any>> {
    try {
      // const checkUrl = await this.campaignSubmitRepository.createQueryBuilder('campaignSubmit')
      //   //where postUrl = createInput.postUrl
      //   .where('postUrl = :postUrl', { postUrl: createInput.postUrl })
      //   .getRawOne();
      // if (checkUrl) {
      //   throw new HttpException('Duplicate URL', 400);
      // }

      const submitIdx = createInput.submitIdx;
      let submitData: any;
      if (submitIdx) {
        submitData = await this.campaignSubmitRepository.createQueryBuilder('campaignSubmit')
          .leftJoin('campaignItem', 'campaignItem', 'campaignItem.campaignIdx = campaignItem.idx')
          .leftJoin('campaign', 'campaign', 'campaignSubmit.campaignIdx = campaign.idx')
          .select([
            'campaignSubmit.campaignName as campaignName',
            'campaignSubmit.itemName as itemName',
          ])
          .addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url as image')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          )
          .where('campaignSubmit.idx = :submitIdx', { submitIdx })
          .getRawOne();
        bufferToString(submitData);
      }

      const thumbnailImage = await thumbnail;
      const filename = thumbnailImage.file.filename; // 원래 파일명

      const firstSetImg = await file1;

      if (!firstSetImg) {
        throw new HttpException('Please upload a file', 400);
      }

      const thumbnail_s3_filename = await this.uploadService.uploadToS3Portfolio(thumbnailImage.file, 'thumbnail');
      const thumbnail_s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/thumbnail/${thumbnail_s3_filename}`;
      console.log('=>(portfolio.service.ts:26) thumbnail_s3_url', thumbnail_s3_url);

      const s3_filename = await this.uploadService.uploadToS3Portfolio(firstSetImg.file, 'portfolio');
      const s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/portfolio/${s3_filename}`;
      console.log('=>(portfolio.service.ts:30) s3_url', s3_url);

      switch (createInput.type) {
        case 1:
          // ocr
          const naverOcrData = await this.ocrService.createNaverOcr([s3_url]);
          console.log('=>(portfolio.service.ts:67) ocrData', naverOcrData);
          // ocrData 리턴 데이터 저장
          const naverData = {
            memberIdx: authUser.idx,
            title: createInput.title,
            thumbnail: thumbnail_s3_url,
            postUrl: createInput.postUrl,
            submitIdx: submitIdx,
            ocrImg: s3_url,
            cumulativeViewCount: naverOcrData.data.cumulativeViewCount,
            cumulativeLikeCount: naverOcrData.data.cumulativeLikeCount,
            cumulativeCommentCount: naverOcrData.data.cumulativeCommentCount,
          };

          const naverResult = await this.portfolioNaverRepository.save(naverData);
          console.log('=>(portfolio.service.ts:58) result', naverResult);
          console.log('=>(portfolio.service.ts:46) naverData', naverData);
          return { data: naverData, submit: submitData };
        case 2:
          const youtubeOcrData = await this.ocrService.createYoutubeOcr([s3_url]);
          console.log('=>(portfolio.service.ts:67) youtubeOcrData', youtubeOcrData);
          const youtubeData = {
            memberIdx: authUser.idx,
            title: createInput.title,
            thumbnail: thumbnail_s3_url,
            postUrl: createInput.postUrl,
            submitIdx: submitIdx,
            ocrImg: s3_url,
            //숫자로 변환
            viewCount: youtubeOcrData.data.viewCount,
            watchTime: youtubeOcrData.data.watchTime,
            averageWatchTime: youtubeOcrData.data.averageWatchTime,
            impressionCount: youtubeOcrData.data.impressionCount,
            clickRate: youtubeOcrData.data.clickRate.toString(),
          };
          const youtubeResult = await this.portfolioYoutubeRepository.save(youtubeData);
          console.log('=>(portfolio.service.ts:137) youtubeResult', youtubeResult);

          return { data: bufferToString(youtubeResult), submit: submitData };
        case 3:
          const secondSetImg = await file2;
          if (!secondSetImg) {
            throw new HttpException('Please upload a file', 400);
          }
          const s3_filename2 = await this.uploadService.uploadToS3Portfolio(secondSetImg.file, 'portfolio');
          const s3_url2 = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/portfolio/${s3_filename2}`;
          console.log('=>(portfolio.service.ts:60) [s3_url, s3_url2]', [s3_url, s3_url2]);
          const instaOcrData: any = await this.ocrService.createInstagramOcr([s3_url, s3_url2]);
          console.log('=>(portfolio.service.ts:151) instaOcrData', instaOcrData);

          const instaData = {
            memberIdx: authUser.idx,
            title: createInput.title,
            thumbnail: thumbnail_s3_url,
            postUrl: createInput.postUrl,
            ocrImg: s3_url,
            ocrImg2: s3_url2,
            submitIdx: submitIdx,
            viewCount: instaOcrData.data.viewCount,
            likeCount: instaOcrData.data.likeCount,
            saveCount: instaOcrData.data.saveCount,
            shareCount: instaOcrData.data.shareCount,
            commentCount: instaOcrData.data.commentCount,
            participateAccountCount: instaOcrData.data.participateAccountCount,
            activityCount: instaOcrData.data.activityCount,
            accountsReachedCount: instaOcrData.data.accountsReachedCount,
          };

          const instaResult = await this.portfolioInstagramRepository.save(instaData);

          return { data: instaData, submit: submitData };
        case 'gpt':
          return await this.ocrService.createGptOcr2([s3_url]);
      }

    } catch (e) {
      console.log('=>(portfolio.service.ts:createPortfolio) createPortfolio 오류', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async updatePortfolio(
    authUser: any,
    updateInput: any,
    thumbnail: any,
    file1: any,
    file2: any,
  ): Promise<any> {
    try {
      console.log('=>(portfolio.service.ts:updatePortfolio) Received Input', updateInput);

      const { type, id, submitIdx, postUrl, title } = updateInput;

      // Determine repository and aliases
      const repositoryMap = {
        1: this.portfolioNaverRepository,
        2: this.portfolioYoutubeRepository,
        3: this.portfolioInstagramRepository,
      };
      const repository = repositoryMap[type];
      if (!repository) throw new HttpException('Invalid portfolio type', 400);

      // Fetch existing data
      const ocrData = await repository.findOne({
        where: { idx: id, memberIdx: authUser.idx },
      });
      bufferToString(ocrData);
      console.log('=>(portfolio.service.ts:207) ocrData', ocrData);
      if (!ocrData) throw new HttpException('Portfolio not found', 404);

      // Handle S3 uploads
      const thumbnailUrl = thumbnail?.file?.filename ? await this.uploadAndDeleteOldFile(thumbnail, 'thumbnail', ocrData.thumbnail) : null;
      const firstImgUrl = file1?.file?.filename ? await this.uploadAndDeleteOldFile(file1, 'portfolio', ocrData.ocrImg) : null;
      const secondImgUrl = file2?.file?.filename ? await this.uploadAndDeleteOldFile(file2, 'portfolio', ocrData.ocrImg2) : null;

      // Extract OCR data
      let ocrResult = null;
      if (type === 1 && firstImgUrl) ocrResult = await this.ocrService.createNaverOcr([firstImgUrl]);
      if (type === 2 && firstImgUrl) ocrResult = await this.ocrService.createYoutubeOcr([firstImgUrl]);
      if (type === 3 && firstImgUrl && secondImgUrl) ocrResult = await this.ocrService.createInstagramOcr([firstImgUrl, secondImgUrl]);

      // Prepare update fields dynamically
      const updateFields: Record<string, any> = {};
      if (title) updateFields.title = title;
      if (postUrl) updateFields.postUrl = postUrl;
      if (thumbnailUrl) updateFields.thumbnail = thumbnailUrl;
      if (firstImgUrl) updateFields.ocrImg = firstImgUrl;
      if (secondImgUrl) updateFields.ocrImg2 = secondImgUrl;


      // Include OCR data
      if (ocrResult?.data) {
        Object.assign(updateFields, this.extractOcrData(ocrResult.data, type));
      }

      // Execute the update query
      const result = await repository.createQueryBuilder()
        .update()
        .set(updateFields)
        .where('idx = :id AND memberIdx = :memberIdx', { id, memberIdx: authUser.idx })
        .execute();

      console.log('=>(portfolio.service.ts:updatePortfolio) Update Result', result);
      if (result.affected === 0) throw new HttpException('No records updated', 400);

      // Fetch updated portfolio details
      return this.getPortfolioDetail(id, type, authUser);

    } catch (e) {
      console.error('=>(portfolio.service.ts:updatePortfolio) Error', e);
      throw new HttpException(e.message || 'Internal Server Error', e.status || 500);
    }
  }

// Helper function for S3 file upload and old file deletion
  private async uploadAndDeleteOldFile(file: any, folder: string, oldUrl: string): Promise<string> {
    if (!file || !file.file || !file.file.createReadStream) {
      console.error('File is missing or invalid:', file);
      throw new HttpException('Invalid file input', 400);
    }

    const newFilename = await this.uploadService.uploadToS3Portfolio(file.file, folder);
    const newUrl = this.makeS3Url(folder, newFilename);

    if (oldUrl) {
      const oldKey = oldUrl.split(`${folder}/`).pop();
      console.log('=>(portfolio.service.ts:262) oldKey', oldKey);
      await this.uploadService.deleteFiles([`${folder}/${oldKey}`]);
    }

    return newUrl;
  }

// Helper function to map OCR data fields
  private extractOcrData(ocrData: any, type: number): Record<string, any> {
    const fieldMap = {
      1: ['cumulativeViewCount', 'cumulativeLikeCount', 'cumulativeCommentCount'],
      2: ['viewCount', 'watchTime', 'averageWatchTime', 'impressionCount', 'clickRate'],
      3: ['viewCount', 'likeCount', 'saveCount', 'shareCount', 'commentCount', 'participateAccountCount', 'activityCount', 'accountsReachedCount'],
    };

    const fields = fieldMap[type] || [];
    return fields.reduce((acc, key) => {
      if (ocrData[key] !== undefined) acc[key] = ocrData[key];
      return acc;
    }, {});
  }

  async updatePortfolio2(authUser: any, updateInput: any, thumbnail: any, file1: any, file2: any): Promise<Promise<any>> {
    try {
      console.log('=>(portfolio.service.ts:184) updateInput.postUrl', updateInput.postUrl);
      let ocrData;
      //portfolio type에 따라서 분기
      switch (updateInput.type) {
        case 1:
          ocrData = await this.portfolioNaverRepository.findOne({
            where: { idx: updateInput.id, memberIdx: authUser.idx },
          });
          break;
        case 2:
          ocrData = await this.portfolioYoutubeRepository.findOne({
            where: { idx: updateInput.id, memberIdx: authUser.idx },
          });
          break;
        case 3:
          ocrData = await this.portfolioInstagramRepository.findOne({
            where: { idx: updateInput.id, memberIdx: authUser.idx },
          });
          break;
      }


      const submitIdx = updateInput.submitIdx;
      let submitData: any;
      if (submitIdx) {
        submitData = await this.campaignSubmitRepository.createQueryBuilder('campaignSubmit')
          .leftJoin('campaignItem', 'campaignItem', 'campaignItem.campaignIdx = campaignItem.idx')
          .leftJoin('campaign', 'campaign', 'campaignSubmit.campaignIdx = campaign.idx')
          .select([
            'campaignSubmit.campaignName as campaignName',
            'campaignSubmit.itemName as itemName',
          ])
          .addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url as image')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          )
          .where('campaignSubmit.idx = :submitIdx', { submitIdx })
          .getRawOne();
        bufferToString(submitData);
      }

      const thumbnailImage = await thumbnail;
      const firstSetImg = await file1;

      let thumbnail_s3_filename = '';
      let thumbnail_s3_url = '';
      let s3_filename = '';
      let s3_url = '';
      if (thumbnailImage) {
        thumbnail_s3_filename = await this.uploadService.uploadToS3Portfolio(thumbnailImage.file, 'thumbnail');
        // thumbnail_s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/profile/${thumbnail_s3_filename}`;
        thumbnail_s3_url = this.makeS3Url('thumbnail', thumbnail_s3_filename);
        console.log('=>(portfolio.service.ts:26) thumbnail_s3_url', thumbnail_s3_url);
      }

      if (firstSetImg?.file?.filename) {
        s3_filename = await this.uploadService.uploadToS3Portfolio(firstSetImg.file, 'portfolio');
        // s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/portfolio/${s3_filename}`;
        s3_url = this.makeS3Url('portfolio', s3_filename);
        console.log('=>(portfolio.service.ts:30) s3_url', s3_url);
      }

      switch (updateInput.type) {
        case 1:
          // ocr
          let naverOcrData;
          if (firstSetImg?.file?.filename) {
            naverOcrData = await this.ocrService.createNaverOcr([s3_url]);
            console.log('=>(portfolio.service.ts:67) ocrData', naverOcrData);
          }

          const query = this.portfolioNaverRepository
            .createQueryBuilder('portfolioNaver')
            .update(PortfolioNaver);

          const updateFields: Record<string, any> = {};

          // 조건부로 필드 추가
          if (updateInput.title) {
            updateFields.title = updateInput.title;
          }
          if (!thumbnailImage?.file?.filename) {
            updateFields.thumbnail = thumbnail_s3_url;
            // ocrData.thumbnail 삭제
            const thumbnailFileName = ocrData.thumbnail.split('/').pop();
            const thumbnailKey = `thumbnail/${thumbnailFileName}`;
            await this.uploadService.deleteFiles([thumbnailKey]);
          }
          if (updateInput.postUrl) {
            updateFields.postUrl = updateInput.postUrl;
          }
          if (firstSetImg?.file?.filename) {
            updateFields.ocrImg = s3_url;
            const ocrImgFileName = ocrData.ocrImg.split('/').pop();
            const ocrImgKey = `portfolio/${ocrImgFileName}`;
            await this.uploadService.deleteFiles([ocrImgKey]);
          }
          if (s3_url) {
            if (naverOcrData?.data?.cumulativeViewCount !== undefined) {
              updateFields.cumulativeViewCount = naverOcrData.data.cumulativeViewCount;
            }
            if (naverOcrData?.data?.cumulativeLikeCount !== undefined) {
              updateFields.cumulativeLikeCount = naverOcrData.data.cumulativeLikeCount;
            }
            if (naverOcrData?.data?.cumulativeCommentCount !== undefined) {
              updateFields.cumulativeCommentCount = naverOcrData.data.cumulativeCommentCount;
            }
          }

          // `set`에 동적으로 추가된 필드들을 설정
          query.set(updateFields);

          // 조건을 추가해 원하는 레코드를 업데이트
          query.where('idx = :id', { id: updateInput.id });
          query.andWhere('memberIdx = :memberIdx', { memberIdx: authUser.idx });

          // 실행
          const result = await query.execute();
          console.log('=>(portfolio.service.ts:281) result', result);
          if (result.affected && result.affected > 0) {
            console.log(`=>(portfolio.service.ts:281) 성공적으로 ${result.affected}개의 레코드가 업데이트되었습니다.`);
            return await this.getPortfolioDetail(updateInput.id, updateInput.type, authUser);
          } else {
            console.log('=>(portfolio.service.ts:281) 업데이트된 레코드가 없습니다.');
          }
          return { data: ocrData, submit: submitData };
        case 2:
          let youtubeOcrData;
          if (firstSetImg?.file?.filename) {
            youtubeOcrData = await this.ocrService.createYoutubeOcr([s3_url]);
            console.log('=>(portfolio.service.ts:67) ocrData', youtubeOcrData);
          }

          const query2 = this.portfolioYoutubeRepository
            .createQueryBuilder('portfolioYoutube')
            .update(PortfolioYoutube);

          const updateFields2: Record<string, any> = {};

          // 조건부로 필드 추가
          if (updateInput.title) {
            updateFields2.title = updateInput.title;
          }
          if (!thumbnailImage?.file?.filename) {
            updateFields2.thumbnail = thumbnail_s3_url;
            // ocrData.thumbnail 삭제
            const thumbnailFileName = ocrData.thumbnail.split('/').pop();
            const thumbnailKey = `thumbnail/${thumbnailFileName}`;
            await this.uploadService.deleteFiles([thumbnailKey]);
          }
          if (updateInput.postUrl) {
            updateFields2.postUrl = updateInput.postUrl;
          }
          if (firstSetImg?.file?.filename) {
            updateFields2.ocrImg = s3_url;
            const ocrImgFileName = ocrData.ocrImg.split('/').pop();
            const ocrImgKey = `portfolio/${ocrImgFileName}`;
            await this.uploadService.deleteFiles([ocrImgKey]);
          }
          if (s3_url) {
            if (youtubeOcrData?.data?.viewCount !== undefined) {
              updateFields2.viewCount = youtubeOcrData.data.viewCount;
            }
            if (youtubeOcrData?.data?.watchTime !== undefined) {
              updateFields2.watchTime = youtubeOcrData.data.watchTime;
            }
            if (youtubeOcrData?.data?.averageWatchTime !== undefined) {
              updateFields2.averageWatchTime = youtubeOcrData.data.averageWatchTime;
            }
            if (youtubeOcrData?.data?.impressionCount !== undefined) {
              updateFields2.impressionCount = youtubeOcrData.data.impressionCount;
            }
            if (youtubeOcrData?.data?.clickRate !== undefined) {
              updateFields2.clickRate = youtubeOcrData.data.clickRate.toString();
            }
          }

          // `set`에 동적으로 추가된 필드들을 설정
          query2.set(updateFields2);

          // 조건을 추가해 원하는 레코드를 업데이트
          query2.where('idx = :id', { id: updateInput.id });
          query2.andWhere('memberIdx = :memberIdx', { memberIdx: authUser.idx });

          // 실행
          const result2 = await query2.execute();
          console.log('=>(portfolio.service.ts:281) result2', result2);
          if (result2.affected && result2.affected > 0) {
            console.log(`=>(portfolio.service.ts:281) 성공적으로 ${result2.affected}개의 레코드가 업데이트되었습니다.`);
            return await this.getPortfolioDetail(updateInput.id, updateInput.type, authUser);
          } else {
            console.log('=>(portfolio.service.ts:281) 업데이트된 레코드가 없습니다.');
          }
          return { data: ocrData, submit: submitData };
        case 3:
          let instaOcrData;
          let s3_url2 = '';
          const secondSetImg = await file2;

          if (secondSetImg?.file?.filename) {
            const s3_filename2 = await this.uploadService.uploadToS3Portfolio(secondSetImg.file, 'portfolio');
            s3_url2 = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/portfolio/${s3_filename2}`;
            console.log('=>(portfolio.service.ts:60) [s3_url, s3_url2]', [s3_url, s3_url2]);
          }

          if (firstSetImg?.file?.filename && secondSetImg?.file?.filename) {
            instaOcrData = await this.ocrService.createInstagramOcr([s3_url, s3_url2]);
          }

          const query3 = this.portfolioInstagramRepository
            .createQueryBuilder('portfolioInstagram')
            .update(PortfolioInstagram);

          const updateFields3: Record<string, any> = {};

          // 조건부로 필드 추가
          if (updateInput.title) {
            updateFields3.title = updateInput.title;
          }
          if (!thumbnailImage?.file?.filename) {
            updateFields3.thumbnail = thumbnail_s3_url;
            // ocrData.thumbnail 삭제
            const thumbnailFileName = ocrData.thumbnail.split('/').pop();
            const thumbnailKey = `thumbnail/${thumbnailFileName}`;
            await this.uploadService.deleteFiles([thumbnailKey]);
          }
          if (updateInput.postUrl) {
            updateFields3.postUrl = updateInput.postUrl;
          }
          if (firstSetImg?.file?.filename) {
            updateFields3.ocrImg = s3_url;
            const ocrImgFileName = ocrData.ocrImg.split('/').pop();
            const ocrImgKey = `portfolio/${ocrImgFileName}`;
            await this.uploadService.deleteFiles([ocrImgKey]);
          }
          if (secondSetImg?.file?.filename) {
            updateFields3.ocrImg2 = s3_url2;
            const ocrImg2FileName = ocrData.ocrImg2.split('/').pop();
            const ocrImg2Key = `portfolio/${ocrImg2FileName}`;
            await this.uploadService.deleteFiles([ocrImg2Key]);
          }
          if (s3_url && s3_url2) {
            if (instaOcrData?.data?.likeCount !== undefined) {
              updateFields3.likeCount = instaOcrData.data.likeCount;
            }
            if (instaOcrData?.data?.saveCount !== undefined) {
              updateFields3.saveCount = instaOcrData.data.saveCount;
            }
            if (instaOcrData?.data?.shareCount !== undefined) {
              updateFields3.shareCount = instaOcrData.data.shareCount;
            }
            if (instaOcrData?.data?.commentCount !== undefined) {
              updateFields3.commentCount = instaOcrData.data.commentCount;
            }
            if (instaOcrData?.data?.participateAccountCount !== undefined) {
              updateFields3.participateAccountCount = instaOcrData.data.participateAccountCount;
            }
            if (instaOcrData?.data?.activityCount !== undefined) {
              updateFields3.activityCount = instaOcrData.data.activityCount;
            }
            if (instaOcrData?.data?.accountsReachedCount !== undefined) {
              updateFields3.accountsReachedCount = instaOcrData.data.accountsReachedCount;
            }
          }

          // `set`에 동적으로 추가된 필드들을 설정
          query3.set(updateFields3);

          // 조건을 추가해 원하는 레코드를 업데이트
          query3.where('idx = :id', { id: updateInput.id });
          query3.andWhere('memberIdx = :memberIdx', { memberIdx: authUser.idx });

          // 실행
          const result3 = await query3.execute();
          console.log('=>(portfolio.service.ts:281) result3', result3);
          if (result3.affected && result3.affected > 0) {
            console.log(`=>(portfolio.service.ts:281) 성공적으로 ${result3.affected}개의 레코드가 업데이트되었습니다.`);
            return await this.getPortfolioDetail(updateInput.id, updateInput.type, authUser);
          } else {
            console.log('=>(portfolio.service.ts:281) 업데이트된 레코드가 없습니다.');
          }

          return { data: ocrData, submit: submitData };
        case 'gpt':
          return await this.ocrService.createGptOcr2([s3_url]);
      }

    } catch (e) {
      console.log('=>(portfolio.service.ts:createPortfolio) createPortfolio 오류', e);
      throw new HttpException(e.message, e.status);
    }
  }


  async getPortfolioList(authUser: any, type: number, page: number, take: number, dataPerPage: number) {
    let data = [];
    let total = 0;
    let totalPage = 0;
    let currentPage = 0;
    try {
      switch (type) {
        case 1:
          data = await this.portfolioNaverRepository.find({
            where: { memberIdx: authUser.idx },
            order: { idx: 'DESC' },
            skip: (page - 1) * take,
            take: take,
          });
          data = bufferToString(data);
          total = await this.portfolioNaverRepository.count({
            where: { memberIdx: authUser.idx },
          });
          break;
        case 2:
          data = await this.portfolioYoutubeRepository.find({
            where: { memberIdx: authUser.idx },
            order: { idx: 'DESC' },
            skip: (page - 1) * take,
            take: take,
          });
          data = bufferToString(data);
          total = await this.portfolioYoutubeRepository.count({
            where: { memberIdx: authUser.idx },
          });
          break;
        case 3:
          data = await this.portfolioInstagramRepository.find({
            where: { memberIdx: authUser.idx },
            order: { idx: 'DESC' },
            skip: (page - 1) * take,
            take: take,
          });
          data = bufferToString(data);
          total = await this.portfolioInstagramRepository.count({
            where: { memberIdx: authUser.idx },
          });
          break;
      }
      console.log('=>(portfolio.service.ts:357) total', total);
      const totalPage = Math.ceil(total / take);
      console.log('=>(portfolio.service.ts:358) totalPage', totalPage);
      if (page > totalPage) {
        throw new NotFoundException();
      }
      const currentPage = page;

      return new Pagination({
        data,
        total,
        totalPage,
        currentPage,
      }, take);

    } catch (e) {
      console.log('=>(portfolio.service.ts:getPortfolioList) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async representativePostingSetting(idx: number, type: number, mark_yn: string, authUser: any) {
    try {
      // Repository와 테이블명 매핑
      const repositoryMap = {
        1: { repository: this.portfolioNaverRepository, alias: 'naver' },
        2: { repository: this.portfolioYoutubeRepository, alias: 'youtube' },
        3: { repository: this.portfolioInstagramRepository, alias: 'instagram' },
      };

      // 해당 type에 맞는 repository 가져오기
      const selectedRepo = repositoryMap[type];
      if (!selectedRepo) {
        throw new HttpException('Invalid type', 400);
      }

      // 데이터 조회
      const data = await selectedRepo.repository
        .createQueryBuilder(selectedRepo.alias)
        .where(`${selectedRepo.alias}.idx = :idx`, { idx })
        .andWhere(`${selectedRepo.alias}.memberIdx = :memberIdx`, { memberIdx: authUser.idx })
        .getRawMany();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);

      if (!data) {
        throw new HttpException('Invalid idx', 400);
      }

      // mark_yn 업데이트
      await selectedRepo.repository.update({ idx }, { mark_yn });

      return { code: 200, message: 'success' };

    } catch (e) {
      console.log('=>(portfolio.service.ts:representativePostingSetting) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async representativePost(type: number, authUser: any) {
    try {
      // Repository와 테이블명 매핑
      const repositoryMap = {
        1: { repository: this.portfolioNaverRepository, alias: 'portfolioNaver' },
        2: { repository: this.portfolioYoutubeRepository, alias: 'portfolioYoutube' },
        3: { repository: this.portfolioInstagramRepository, alias: 'portfolioInstagram' },
      };

      // 해당 type에 맞는 repository 가져오기
      const selectedRepo = repositoryMap[type];
      if (!selectedRepo) {
        throw new HttpException('Invalid type', 400);
      }
      console.log('=>(portfolio.service.ts:261) selectedRepo.alias', selectedRepo.alias);
      // 대표 포스트 조회
      const data = await selectedRepo.repository
        .createQueryBuilder(selectedRepo.alias)
        .select('*')
        .where(`mark_yn = 'Y'`)
        .andWhere(`memberIdx = :memberIdx`, { memberIdx: authUser.idx })
        .getRawMany();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);

      return data;

    } catch (e) {
      console.log('=>(portfolio.service.ts:representativePost) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getPortfolioDetail(idx: number, type: number, authUser: any) {
    try {
      // Repository와 테이블명 매핑
      const repositoryMap = {
        1: { repository: this.portfolioNaverRepository, alias: 'naver' },
        2: { repository: this.portfolioYoutubeRepository, alias: 'youtube' },
        3: { repository: this.portfolioInstagramRepository, alias: 'instagram' },
      };

      // 해당 type에 맞는 repository 가져오기
      const selectedRepo = repositoryMap[type];
      if (!selectedRepo) {
        throw new HttpException('Invalid type', 400);
      }

      // 데이터 조회
      const data = await selectedRepo.repository
        .createQueryBuilder(selectedRepo.alias)
        .select('*')
        // .addSelect('DATE_FORMAT(\'2024-12-16T15:40:44\', \'%Y-%m-%d %H:%i:%s\')')
        .where(`${selectedRepo.alias}.idx = :idx`, { idx })
        .andWhere(`${selectedRepo.alias}.memberIdx = :memberIdx`, { memberIdx: authUser.idx })
        .getRawOne();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);

      if (!data) {
        throw new HttpException('Invalid idx', 400);
      }

      let submitData = null;
      if (data.submitIdx) {
        submitData = await this.campaignSubmitRepository.createQueryBuilder('campaignSubmit')
          .leftJoin('campaignItem', 'campaignItem', 'campaignItem.campaignIdx = campaignItem.idx')
          .leftJoin('campaign', 'campaign', 'campaignSubmit.campaignIdx = campaign.idx')
          .select([
            'campaignSubmit.campaignName as campaignName',
            'campaignSubmit.itemName as itemName',
            'campaignSubmit.idx as submitIdx',
          ])
          .addSelect(
            (subQuery) =>
              subQuery
                .select('aws_url as image')
                .from('campaignImage', 'ci')
                .where('ci.campaignIdx = campaign.idx')
                .orderBy('ordering', 'ASC')
                .limit(1),
            'image',
          )
          .where('campaignSubmit.idx = :submitIdx', { submitIdx: data.submitIdx })
          .getRawOne();
        bufferToString(submitData);
        console.log('=>(portfolio.service.ts:228) submitData', submitData);

      }

      return { data: data, submit: submitData };
    } catch (e) {
      console.log('=>(portfolio.service.ts:getPortfolioDetail) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async getPortfolioAnalyze(type: number, authUser: any) {
    try {
      // Repository와 테이블명 매핑
      const repositoryMap = {
        1: { repository: this.blogAnalysisRepository, alias: 'naver' },
        2: { repository: this.youtubeAnalysisRepository, alias: 'youtube' },
        3: { repository: this.instagramAnalysisRepository, alias: 'instagram' },
      };
      // 해당 type에 맞는 repository 가져오기
      const selectedRepo = repositoryMap[type];
      if (!selectedRepo) {
        throw new HttpException('Invalid type', 400);
      }

      const data = await selectedRepo.repository
        .createQueryBuilder(selectedRepo.alias)
        .select('*')
        .where(`${selectedRepo.alias}.memberIdx = :memberIdx`, { memberIdx: authUser.idx })
        .getRawOne();

      bufferToString(data);

      if (data.targetAnalysis) {
        data.targetAnalysis = JSON.parse(data.targetAnalysis);
      }
      if (data) {
        data.hashtags = JSON.parse(data.hashtags);
        data.createdAt = iosDateToYYMMDD(data.createdAt);
        data.updatedAt = iosDateToYYMMDD(data.updatedAt);

      }
      console.log('=>(portfolio.service.ts:228) data', data);
      return data;

    } catch (e) {
      console.log('=>(portfolio.service.ts:getPortfolioAnalyze) e', e);
      throw new HttpException(e.message, e.status);
    }

  }

  async getMarkCount(type: number, authUser: any) {
    try {
      // Repository와 테이블명 매핑
      const repositoryMap = {
        1: { repository: this.portfolioNaverRepository, alias: 'naver' },
        2: { repository: this.portfolioYoutubeRepository, alias: 'youtube' },
        3: { repository: this.portfolioInstagramRepository, alias: 'instagram' },
      };

      // 해당 type에 맞는 repository 가져오기
      const selectedRepo = repositoryMap[type];
      if (!selectedRepo) {
        throw new HttpException('Invalid type', 400);
      }

      // 데이터 조회
      const data = await selectedRepo.repository
        .createQueryBuilder(selectedRepo.alias)
        .select('*')
        .where(`${selectedRepo.alias}.mark_yn = 'Y'`)
        .andWhere(`${selectedRepo.alias}.memberIdx = :memberIdx`, { memberIdx: authUser.idx })
        .getRawMany();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);

      return data.length;

    } catch (e) {
      console.log('=>(portfolio.service.ts:getMarkCount) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async createProfile2(authUser: any, createInput: any, thumbnail: any) {
    try {
      const profileImage = await thumbnail;
      const filename = profileImage.file.filename; // 원래 파일명

      const profileImage_s3_filename = await this.uploadService.uploadToS3Portfolio(profileImage.file, 'profile');
      const profileImage_s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/profile/${profileImage_s3_filename}`;
      console.log('=>(portfolio.service.ts:26) profileImage', profileImage);

      if (createInput.nickname) {
        // 닉네임 중복 체크
        const nicknameCheck = await this.memberRepository.findOne({
          where: { nickname: createInput.nickname },
        });
        if (nicknameCheck) {
          throw new HttpException('Nickname already exists', 400);
        }
        //update nickname
        await this.memberRepository.update({ idx: authUser.idx }, { nickname: createInput.nickname });
      }

      if (profileImage_s3_filename) {
        //upsert aws_url
        await this.memberProfileRepository.upsert({
          memberIdx: authUser.idx,
          aws_url: profileImage_s3_url,
        }, { conflictPaths: ['memberIdx'] });
      }

      if (createInput.keyword) {
        await this.memberProfileRepository.upsert({
          memberIdx: authUser.idx,
          keyword: JSON.stringify(createInput.keyword),
        }, { conflictPaths: ['memberIdx'] });
      }
    } catch (e) {
      console.log('=>(portfolio.service.ts:createProfile) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  async createProfile(authUser: any, createInput: any, thumbnail: any) {
    try {
      if (createInput.nickname) {
        // 닉네임 중복 체크
        const nicknameCheck = await this.memberRepository.findOne({
          where: { nickname: createInput.nickname, idx: Not(authUser.idx) },
        });
        if (nicknameCheck) {
          return {
            code: 400,
            message: 'Nickname already exists',
          };
        }
      }

      // 닉네임 처리
      if (createInput.nickname) {
        // 닉네임 업데이트
        await this.memberRepository.update(
          { idx: authUser.idx },
          { nickname: createInput.nickname },
        );
      }

      // AWS URL 및 키워드 병합 처리
      const upsertData: any = {
        memberIdx: authUser.idx,
      };
      const profileImage = await thumbnail;

      if (profileImage?.file?.createReadStream) {
        const profileImage_s3_filename = await this.uploadService.uploadToS3Portfolio(
          profileImage.file,
          'profile',
        );
        const profileImage_s3_url = `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/profile/${profileImage_s3_filename}`;
        console.log('=>(portfolio.service.ts:26) profileImage', profileImage);

        if (profileImage_s3_filename) {
          upsertData.aws_url = profileImage_s3_url;
        }
      }
      if (createInput.keyword) {
        upsertData.keyword = JSON.stringify(createInput.keyword);
      }

      // upsert 실행
      // await this.memberProfileRepository.upsert(upsertData, {
      //   conflictPaths: ['memberIdx'], // 중복 키 조건
      // });
      const existingProfile = await this.memberProfileRepository.findOne({
        where: { memberIdx: authUser.idx },
      });

      if (existingProfile) {
        // 이미 존재하면 업데이트
        await this.memberProfileRepository.update(existingProfile.idx, upsertData);
      } else {
        // 존재하지 않으면 새로 생성
        await this.memberProfileRepository.save(upsertData);
      }

      const data = await this.memberProfileRepository.createQueryBuilder('memberProfile')
        .leftJoin('member', 'member', 'member.idx = memberProfile.memberIdx')
        .select(['member.nickname as nickname', 'memberProfile.aws_url as aws_url', 'memberProfile.keyword as keyword'])
        .where('memberProfile.memberIdx = :memberIdx', { memberIdx: authUser.idx })
        .getRawOne();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);
      //keyword 파싱
      if (data.keyword) {
        const parsedOnce = JSON.parse(data.keyword);
        console.log('=>(portfolio.service.ts:562) data.keyword', typeof data.keyword);
        // 두 번째 파싱: 최종 배열로 변환
        const finalArray = Array.isArray(parsedOnce) ? parsedOnce : JSON.parse(parsedOnce);
        console.log(finalArray); // ["#test", "#tes22t2"]
        data.keyword = finalArray;
      }

      return {
        code: 200,
        message: 'success',
        data: data,
      };
    } catch (e) {
      console.log('=>(portfolio.service.ts:createProfile) e', e);
      return {
        code: 500,
        message: e.message,
      };
    }
  }

  async getProfile(authUser: any) {
    try {
      const data = await this.memberRepository.createQueryBuilder('member')
        .leftJoin('member_profile', 'memberProfile', 'memberProfile.memberIdx = member.idx')
        .select(['member.nickname as nickname', 'memberProfile.aws_url as aws_url', 'memberProfile.keyword as keyword'])
        .where('member.idx = :idx', { idx: authUser.idx })
        .getRawOne();
      bufferToString(data);
      console.log('=>(portfolio.service.ts:228) data', data);
      //keyword 파싱
      if (!data) {
        return {
          code: 400,
          message: 'No data',
          data:
            {
              nickname: '',
              aws_url: '',
              keyword: [],
            },
        };
      }
      if (data.keyword) {
        const parsedOnce = JSON.parse(data.keyword);
        console.log('=>(portfolio.service.ts:562) data.keyword', typeof data.keyword);
        // 두 번째 파싱: 최종 배열로 변환
        const finalArray = Array.isArray(parsedOnce) ? parsedOnce : JSON.parse(parsedOnce);
        console.log(finalArray); // ["#test", "#tes22t2"]
        data.keyword = finalArray;
      } else {
        data.keyword = [];
      }

      return {
        code: 200,
        message: 'success',
        data: data,
      };
    } catch (e) {
      console.log('=>(portfolio.service.ts:getProfile) e', e);
      throw new HttpException(e.message, e.status);
    }
  }

  /**
   * URL 중복 체크
   * @param {string} postUrl
   * @returns {Promise<{code: number, message: any} | boolean>}
   */
  async checkUrl(postUrl: string): Promise<{ code: number; message: any; } | boolean> {
    try {
      const checkUrl = await this.campaignSubmitRepository.createQueryBuilder('campaignSubmit')
        .where('postUrl = :postUrl', { postUrl: postUrl })
        .getRawOne();
      console.log('=>(portfolio.service.ts:775) checkUrl', checkUrl);
      if (checkUrl) {
        throw new HttpException('Duplicate URL', 400);
      }
      return false;
    } catch (e) {
      console.log('=>(portfolio.service.ts:checkUrl) e', e);
      return {
        code: 500,
        message: e.message,
      };
    }
  }

  /**
   * S3 URL 생성
   * @param {string} segment
   * @param {string} name
   * @returns {string}
   */
  makeS3Url(segment: string, name: string): string {
    return `https://${process.env.AWS_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/${segment}/${name}`;
  }

  async updatePortfolioAnalyze(updatePortfolioAnalyzeInput: any, authUser: Member) {
    try {
      const type = updatePortfolioAnalyzeInput.type;
      const link = updatePortfolioAnalyzeInput.link;
      const data = {
        type: type,
        link: link,
      };

      this.memberService.setAnalysisChannel(data, authUser);

    } catch (e) {
      console.log('=>(portfolio.service.ts:updatePortfolioAnalyze) e', e);
      throw new HttpException(e.message, e.status);
    }
  }
}
