import { Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { FcmController } from './fcm.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as process from 'process';
import * as admin from 'firebase-admin';
import { MemberDevice } from '../../entity/entities/MemberDevice';
import { Member } from '../../entity/entities/Member';
import { FcmTextTransform } from '../../entity/entities/FcmTextTransform';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushLog } from '../../entity/entities/PushLog';
import { Affiliate } from '../../entity/entities/Affiliate';

const firebaseProvider = {
  provide: 'FIREBASE_APP',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const firebaseConfig = {
      // type: configService.get<string>('TYPE'),
      project_id: process.env.FIREBASE_PROJECT_ID,
      // private_key_id: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      // client_id: configService.get<string>('CLIENT_ID'),
      // auth_uri: configService.get<string>('AUTH_URI'),
      // token_uri: configService.get<string>('TOKEN_URI'),
      // auth_provider_x509_cert_url: configService.get<string>('AUTH_CERT_URL'),
      // client_x509_cert_url: configService.get<string>('CLIENT_CERT_URL'),
      // universe_domain: configService.get<string>('UNIVERSAL_DOMAIN'),
    } as admin.ServiceAccount;

    return admin.initializeApp(
      {
        credential: admin.credential.cert(firebaseConfig),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      },
      'FcmApp',
    ); // Naming the app instance for clarity
  },
};

@Module({
  imports: [TypeOrmModule.forFeature([MemberDevice, Member, FcmTextTransform, PushLog, Affiliate]), ConfigModule],
  controllers: [FcmController],
  providers: [FcmService, firebaseProvider],
  exports: [firebaseProvider, FcmService], //
})
export class FcmModule {}
