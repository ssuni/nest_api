import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FcmService } from './fcm.service';

@Controller('fcm')
export class FcmController {
  constructor(private readonly fcmService: FcmService) {}

  @Post('send')
  async sendFcmMessage(@Body() data: any) {
    try {
      return await this.fcmService.sendFcmMessage(data);
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error(error);
    }
  }

  @Post('sends')
  async sendFcmMessages(@Body() data: any) {
    try {
      return await this.fcmService.sendFcmMessages(data);
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error(error);
    }
  }

  @Post('reservedDelivery')
  async reservedDelivery(@Body() data: any) {
    try {
      return await this.fcmService.reservedDelivery(data);
    } catch (error) {
      console.error('Error reserved delivery:', error);
      throw new Error(error);
    }
  }

  @Post('deleteDeviceModel')
  async deleteDeviceModel(@Body() data: any) {
    try {
      return await this.fcmService.deleteDeviceModel(data);
    } catch (error) {
      console.error('Error deleting device model:', error);
      throw new Error(error);
    }
  }

  @Post('proxySend')
  async proxySend(@Body() data: any) {
    try {
      return await this.fcmService.proxySend(data);
    } catch (error) {
      console.error('Error in proxy send:', error);
      throw new Error(error);
    }
  }

  @Post('proxySendMultiple')
  async proxySendMultiple(@Body() data: any) {
    try {
      return await this.fcmService.proxySendMultiple(data);
    } catch (error) {
      console.error('Error in proxy send:', error);
      throw new Error(error);
    }
  }

  @Post('getMarketingMessageMemberList')
  async getRandomMessageMemberList(
    @Body('ids') ids: string, // Example: '1,2,3' for multiple IDs
    @Body('titleTransform') titleTransform: string, // Optional title for the message
    @Body('contentTransform') contentTransform: string, // Optional content for the message
    @Body('room') room: string, // Optional room for the message
    @Body('roomId') roomId: string, // Optional room ID for the message
  ) {
    try {
      return await this.fcmService.getMarketingMessageMemberList(ids, titleTransform, contentTransform, room, roomId);
    } catch (error) {
      console.error('Error getting random message member list:', error);
      throw new Error(error);
    }
  }
}
