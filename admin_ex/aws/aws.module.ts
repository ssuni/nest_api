import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as mime from 'mime-types';
import { AwsController } from './aws.controller';
import s3Storage from 'multer-s3';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import * as multerS3 from 'multer-s3';
import { AwsService } from './aws.service';
import { multerOptionsFactory } from './multer-options.factory';
@Module({
  // imports: [
  //   MulterModule.registerAsync({
  //     imports: [ConfigModule],
  //     useFactory: multerOptionsFactory,
  //     inject: [ConfigService],
  //   }),
  // ],
  // imports: [
  //   MulterModule.registerAsync({
  //     imports: [ConfigModule],
  //     inject: [ConfigService],
  //     useFactory(configService: ConfigService) {
  //       const s3 = new S3Client({
  //         region: configService.get('AWS_REGION'),
  //         credentials: {
  //           accessKeyId: configService.get('AWS_S3_ACCESS_KEY'),
  //           secretAccessKey: configService.get('AWS_S3_SECRET_ACCESS_KEY'),
  //         },
  //       });
  //
  //       return {
  //         storage: multerS3({
  //           s3,
  //           bucket: configService.get('AWS_S3_BUCKET'),
  //           acl: 'public-read',
  //           contentType: multerS3.AUTO_CONTENT_TYPE,
  //           key: function (req, file, cb) {
  //             cb(null, `${new Date().getTime()}.${mime.extension(file.mimetype)}`);
  //           },
  //         }),
  //         limits: {
  //           fileSize: 1024 * 1024 * 5, // 5 MB
  //           files: 1,
  //         },
  //         fileFilter(req, file, callback) {
  //           callback(null, true);
  //         },
  //       };
  //     },
  //   }),
  // ],
  controllers: [AwsController],
  providers: [AwsService],
})
export class AwsModule {}
