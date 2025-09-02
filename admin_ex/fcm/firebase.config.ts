import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase-admin/auth';
import { getAuth as getAppAuth } from 'firebase/auth';

export const getAdminAuth = (configService: ConfigService) => {
  const serviceAccount = {
    type: configService.get<string>('firebase.type'),
    project_id: configService.get<string>('firebase.projectId'),
    private_key_id: configService.get<string>('firebase.privateKeyId'),
    private_key: configService.get<string>('firebase.privateKey'),
    client_email: configService.get<string>('firebase.clientEmail'),
    client_id: configService.get<string>('firebase.clientId'),
    auth_uri: configService.get<string>('firebase.authUri'),
    token_uri: configService.get<string>('firebase.tokenUri'),
    auth_provider_x509_cert_url: configService.get<string>('firebase.authCertUrl'),
    client_x509_cert_url: configService.get<string>('firebase.clientCertUrl'),
    universe_domain: configService.get<string>('firebase.universeDomain'),
  };

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: `https://${configService.get<string>('firebase.projectId')}.firebaseio.com`,
    storageBucket: configService.get<string>('firebase.storageBucket'),
  });

  return getAuth(app);
};

export const getFirebaseAppAuth = (configService: ConfigService) => {
  const firebaseConfig = {
    apiKey: configService.get<string>('firebase.apiKey'),
    authDomain: configService.get<string>('firebase.authDomain'),
    projectId: configService.get<string>('firebase.projectId'),
    storageBucket: configService.get<string>('firebase.storageBucket'),
    messagingSenderId: configService.get<string>('firebase.senderId'),
    appId: configService.get<string>('firebase.appId'),
  };

  const app = initializeApp(firebaseConfig);

  return getAppAuth(app);
};

export const getMessaging = (configService: ConfigService) => {
  const serviceAccount = {
    type: configService.get<string>('firebase.type'),
    project_id: configService.get<string>('firebase.projectId'),
    private_key_id: configService.get<string>('firebase.privateKeyId'),
    private_key: configService.get<string>('firebase.privateKey'),
    client_email: configService.get<string>('firebase.clientEmail'),
    client_id: configService.get<string>('firebase.clientId'),
    auth_uri: configService.get<string>('firebase.authUri'),
    token_uri: configService.get<string>('firebase.tokenUri'),
    auth_provider_x509_cert_url: configService.get<string>('firebase.authCertUrl'),
    client_x509_cert_url: configService.get<string>('firebase.clientCertUrl'),
    universe_domain: configService.get<string>('firebase.universeDomain'),
  };

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: `https://${configService.get<string>('firebase.projectId')}.firebaseio.com`,
    storageBucket: configService.get<string>('firebase.storageBucket'),
  });

  return app.messaging();
};
