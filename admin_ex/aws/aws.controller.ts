import { Body, Controller, Delete, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AwsService } from './aws.service';
import { convertImageToWebP } from '../util/convertImageToWebP';
import { ResizeImagePipe } from '../util/resize-image.pipe';

@Controller('s3')
export class AwsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly awsService: AwsService,
  ) {}

  //Webp 파일 업로드
  @Post('/uploadWebp')
  @UseInterceptors(FilesInterceptor('file', 10))
  async uploadWebpFile(
    @UploadedFiles(new ResizeImagePipe())
    files: Express.Multer.File,
  ) {
    try {
      //파일 갯수 확인
      const filesLength = Object.keys(files).length;

      for (let i = 0; i < filesLength; i++) {
        const originalFilename = files[i].originalname;
        const webPFilename = originalFilename.replace(/\.[^.]+$/, '.webp');
        const buffer = files[i].buffer;
        await convertImageToWebP(buffer, `./uploads/${webPFilename}`);

        const data = await this.awsService.uploadFilesWebp(files, 'webp');
        console.log('=>(aws.controller.ts:32) data', data);
      }
    } catch (e) {
      console.error('=>(aws.controller.ts:27) e', e);
    }
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile()
    files: Express.Multer.File,
  ) {
    return files;
  }

  @Post('/copy')
  @UseInterceptors(FileInterceptor('file'))
  async copyFile() {
    const files = await this.awsService.copyFile();
    return files;
  }

  @Post('/uploads')
  @UseInterceptors(FilesInterceptor('file', 2)) // 2은 최대파일개수
  async uploadFiles(@UploadedFiles() files, @Body('path') path: string) {
    const data = await this.awsService.uploadFiles(files, path);
    return data;
  }

  @Delete('/deleteImage')
  async deleteImage(@Body('keys') keys: string[]) {
    console.log('=>(aws.controller.ts:35) key', keys);
    const data = await this.awsService.deleteFiles(keys);
    return data;
  }
}
