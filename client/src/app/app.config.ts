import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideIonicAngular } from '@ionic/angular';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { getApp } from 'firebase/app';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { firebaseAppCheckSiteKey, firebaseConfig } from './firebase-config';

const appCheckProviders = firebaseAppCheckSiteKey
  ? [
      provideAppCheck(() =>
        initializeAppCheck(getApp(), {
          provider: new ReCaptchaV3Provider(firebaseAppCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        }),
      ),
    ]
  : [];
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { CMS_CONNECTION } from '../shared/models/cms-publication';
import { CmsClientService } from '../shared/services/cms-client.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: CMS_CONNECTION, useExisting: CmsClientService },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideIonicAngular({}),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    ...appCheckProviders,
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions(undefined, 'asia-east1')),
  ],
};
