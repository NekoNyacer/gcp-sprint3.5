import { routes } from './app/app.routes';
import { importProvidersFrom } from '@angular/core';
import { CubDialogModule } from 'cub-lib-view-rootng/component/dialog';
import { CUB_DRAWER_PROVIDER_LIST, CubDrawerModule } from 'cub-lib-view-rootng/component/drawer';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { provideRouter, withViewTransitions } from '@angular/router';
bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideRouter(routes, withViewTransitions()),
    importProvidersFrom(CubDialogModule),
    importProvidersFrom(CubDrawerModule),
    CUB_DRAWER_PROVIDER_LIST,
  ],
}).catch(console.error);
