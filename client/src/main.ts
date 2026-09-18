import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  // Firebase prints a one-time debug token in DevTools. Register that token
  // in Firebase Console; never commit the token or ship this debug build.
  (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
