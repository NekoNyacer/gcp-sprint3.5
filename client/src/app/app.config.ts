import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideIonicAngular } from '@ionic/angular';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFunctions, provideFunctions } from '@angular/fire/functions';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideIonicAngular({}),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions(undefined, 'asia-east1')),
  ],
};

const firebaseConfig = {
  apiKey: 'AIzaSyBeqnYtJlJ4BErvVyPGzsA4vRVqji0LpWg',
  authDomain: 'cathay-ai-hackathon-team-03.firebaseapp.com',
  projectId: 'cathay-ai-hackathon-team-03',
  storageBucket: 'cathay-ai-hackathon-team-03.firebasestorage.app',
  messagingSenderId: '1039933163857',
  appId: '1:1039933163857:web:943bf35acf6c5f0d706b70',
};
