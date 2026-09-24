import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('../features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('../shared/components/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('../features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'task',
        loadComponent: () => import('../features/task/task.component').then((m) => m.TaskComponent),
      },
      {
        path: 'task/:taskId',
        loadComponent: () => import('../features/task/task-detail.component').then((m) => m.TaskDetailComponent),
      },
      {
        path: 'collection',
        loadComponent: () =>
          import('../features/collection/collection.component').then((m) => m.CollectionComponent),
      },
      {
        path: 'shop/history',
        loadComponent: () =>
          import('../features/shop/history/shop-history.component').then(
            (m) => m.ShopHistoryComponent,
          ),
      },
      {
        path: 'shop',
        loadComponent: () => import('../features/shop/shop.component').then((m) => m.ShopComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'test',
        loadComponent: () =>
          import('../features/test-component/test-component.component').then(
            (m) => m.TestComponentComponent,
          ),
      },
      {
        path: 'game',
        loadComponent: () => import('../features/game/game.component').then((m) => m.GameComponent),
      },
      {
        path: 'upload',
        loadComponent: () =>
          import('../shared/components/upload/upload.component').then((m) => m.UploadComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
