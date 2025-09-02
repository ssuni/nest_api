import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PortfolioService } from './portfolio.service';
// import * as GraphQLUpload from 'graphql-upload/GraphQLUpload';
import { FileUpload } from '../upload/dto/file-upload.interface';
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.js';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../auth/GqlAuthGuard';
import { AuthUser } from '../../auth/auth-user.decorator';
import { Member } from '../../../entity/entities/Member';

@Resolver()
export class PortfolioResolver {
  constructor(private readonly portfolioService: PortfolioService) {
  }

  /**
   * @name createPortfolio
   * @description 포트폴리오 생성
   * @method Mutation
   * @param createInput
   * @param {FileUpload} thumbnail
   * @param {FileUpload} file1
   * @param {FileUpload} file2
   * @param {Member} authUser
   * @returns {Promise<{code: number, data: Promise<any>, message: string}>}
   */
  @Mutation('createPortfolio')
  @UseGuards(GqlAuthGuard)
  async createPortfolio(
    @Args('createInput') createInput: any,
    @Args('file0', { type: async () => GraphQLUpload }) thumbnail: FileUpload,
    @Args('file1', { type: async () => GraphQLUpload }) file1: FileUpload,
    @Args('file2', { type: async () => GraphQLUpload }) file2: FileUpload,
    @AuthUser() authUser: Member,
  ) {
    console.log('=>(portfolio.resolver.ts:23) createInput', createInput);

    const {
      data,
      submit,
    } = await this.portfolioService.createPortfolio(authUser, createInput, thumbnail, file1, file2);
    console.log('=>(portfolio.resolver.ts:42) submit', submit);
    console.log('=>(portfolio.resolver.ts:43) data', data);
    return {
      code: 200,
      message: 'success',
      data: data,
      portfolioSubmit: submit,
    };
  }

  @Mutation('updatePortfolio')
  @UseGuards(GqlAuthGuard)
  async updatePortfolio(
    @Args('updateInput') updateInput: any,
    @Args('file0', { type: async () => GraphQLUpload }) thumbnail: FileUpload,
    @Args('file1', { type: async () => GraphQLUpload }) file1: FileUpload,
    @Args('file2', { type: async () => GraphQLUpload }) file2: FileUpload,
    @AuthUser() authUser: Member,
  ) {
    console.log('=>(portfolio.resolver.ts:23) createInput', updateInput);
    const {
      data,
      submit,
    } = await this.portfolioService.updatePortfolio(authUser, updateInput, thumbnail, file1, file2);
    console.log('=>(portfolio.resolver.ts:42) submit', submit);
    console.log('=>(portfolio.resolver.ts:42) data', data);
    return {
      code: 200,
      message: 'success',
      data: data,
      portfolioSubmit: submit,
    };
  }

  @Mutation('createProfile')
  @UseGuards(GqlAuthGuard)
  async createProfile(
    @Args('createInput') createInput: any,
    @Args('file0', { type: async () => GraphQLUpload }) thumbnail: FileUpload,
    @AuthUser() authUser: Member,
  ) {
    console.log('=>(portfolio.resolver.ts:23) createInput', createInput);

    const data = await this.portfolioService.createProfile(authUser, createInput, thumbnail);
    console.log('=>(portfolio.resolver.ts:42) data', data);
    return data;
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getProfile(
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.getProfile(authUser);
    return data;
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getMarkCount(
    @Args('type', { type: () => Int }) type: number,
    @AuthUser() authUser: Member,
  ) {
    console.log('=>(portfolio.resolver.ts:57) type', type);
    const data = await this.portfolioService.getMarkCount(type, authUser);
    return {
      code: 200,
      message: 'success',
      data: data,
    };
  }

  /**
   * @name getPortfolioList
   * @description 포트폴리오 리스트 조회
   * @param {number} type
   * @param {number} page
   * @param {number} take
   * @param {number} dataPerPage
   * @param {Member} authUser
   * @returns {Promise<{code: number, data: void, message: string}>}
   */
  @Query()
  @UseGuards(GqlAuthGuard)
  async getPortfolioList(
    @Args('type', { type: () => Int }) type: number,
    @Args('page') page: number,
    @Args('take') take: number,
    @Args('dataPerPage') dataPerPage: number,
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.getPortfolioList(authUser, type, page, take, dataPerPage);
    return data;
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async representativePost(
    @Args('type', { type: () => Int }) type: number,
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.representativePost(type, authUser);
    console.log('=>(portfolio.resolver.ts:76) data', data);
    return { data: data };
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getPortfolioDetail(
    @Args('idx', { type: () => Int }) idx: number,
    @Args('type', { type: () => Int }) type: number,
    @AuthUser() authUser: Member,
  ) {
    const { data, submit } = await this.portfolioService.getPortfolioDetail(idx, type, authUser);
    return {
      code: 200,
      message: 'success',
      data: data,
      portfolioSubmit: submit,
    };
  }

  @Mutation('representativePostingSetting')
  @UseGuards(GqlAuthGuard)
  async representativePostingSetting(
    @Args('idx', { type: () => Int }) idx: number,
    @Args('type', { type: () => Int }) type: number,
    @Args('mark_yn', { type: () => String }) mark_yn: string,
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.representativePostingSetting(idx, type, mark_yn, authUser);
    return data;
  }

  @Query()
  @UseGuards(GqlAuthGuard)
  async getPortfolioAnalyze(
    @Args('type', { type: () => Int }) type: number,
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.getPortfolioAnalyze(type, authUser);
    return {
      code: 200,
      message: 'success',
      data: data,
    };
  }

  @Mutation('updatePortfolioAnalyze')
  @UseGuards(GqlAuthGuard)
  async updatePortfolioAnalyze(
    @Args('updatePortfolioAnalyzeInput') updatePortfolioAnalyzeInput: any,
    @AuthUser() authUser: Member,
  ) {
    const data = await this.portfolioService.updatePortfolioAnalyze(updatePortfolioAnalyzeInput, authUser);
    return {
      code: 200,
      message: 'success',
      data: data,
    };
  }
}
