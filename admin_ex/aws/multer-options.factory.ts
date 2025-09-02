import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as multerS3 from 'multer-s3';
import { basename, extname } from 'path';
import * as mime from 'mime-types';

export const multerOptionsFactory = (configService: ConfigService, req): MulterOptions => {
  console.log('=>(multer-options.factory.ts:10) req', req);
  if (!configService) {
    throw new Error('ConfigService is undefined');
  }
  return {
    storage: multerS3({
      s3: new S3Client({
        region: configService.get('AWS_REGION'),
        credentials: {
          accessKeyId: configService.get('AWS_S3_ACCESS_KEY'),
          secretAccessKey: configService.get('AWS_S3_SECRET_ACCESS_KEY'),
        },
      }),
      bucket: configService.get('AWS_S3_BUCKET'),
      //acl: 'public-read',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata(req, file, callback) {
        callback(null, { owner: 'it' });
        // callback(null, `${new Date().getTime()}.${mime.extension(file.mimetype)}`);
      },
      key(req, file, callback) {
        const ext = extname(file.originalname); // 확장자
        const baseName = basename(file.originalname, ext); // 확장자 제외
        // 파일이름-날짜.확장자
        const fileName =
          ext === '.mp4' ? `videos/${baseName}-${Date.now()}${ext}` : `images/${baseName}-${Date.now()}${ext}`;
        // callback(null, fileName);
        callback(null, `${new Date().getTime()}.${mime.extension(file.mimetype)}`);
      },
    }),
    // 파일 크기 제한
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  };
};
