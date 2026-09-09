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
        path: 'collection',
        loadComponent: () =>
          import('../features/collection/collection.component').then((m) => m.CollectionComponent),
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
