import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './util/HttpExceptionFilter';
import { winstonLogger } from './util/winston.util';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { Request, Response, NextFunction } from 'express'; // ✅ 여기서 express 직접

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 요청 본문 크기 제한을 50MB로 설정
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.useLogger(winstonLogger);
  // app.enableCors(); // cors 활성화
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    optionsSuccessStatus: 200,
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  });

  // ✅ 요청마다 IP 출력하는 미들웨어 추가
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    //호출 시간 추가
    const currentTime = new Date().toISOString();
    // 요청 IP와 URL을 로그로 출력
    console.log(`[Request Time] ${currentTime}`);
    console.log(`[Request IP] ${ip} | URL: ${req.method} ${req.originalUrl}`);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //DTO에 없는 속성은 제거
      forbidNonWhitelisted: true, //DTO에 없는 속성이 있는 경우 요청 자체를 막음
      transform: true, //요청에서 넘어온 자료들의 형변환
      transformOptions: {
        enableImplicitConversion: true, //true로 해야만 transform이 작동
      },
      exceptionFactory: (errors) => new BadRequestException(errors), //유효성 검사 실패시 에러 메시지
    }),
  ); //전역 유효성 검사 활성화
  //예외 필터 연결
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT || 3000);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('SECOND_DB_USER:', process.env.SECOND_DB_USER);
}
bootstrap().then(() => console.log(`NestJS Admin Server Start PORT : ${process.env.PORT}`));
