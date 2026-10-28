import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('../features/presentation/presentation.component').then((m) => m.PresentationComponent),
  },
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
        loadComponent: () =>
          import('../features/task/task-detail.component').then((m) => m.TaskDetailComponent),
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
        loadComponent: () => import('../features/shop/points-shop.component').then((m) => m.PointsShopComponent),
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
        path: 'lobby',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../features/lobby/lobby.component').then((m) => m.LobbyComponent),
          },
          {
            path: 'rooms/:seq',
            loadComponent: () =>
              import('../features/lobby/room/room.component').then((m) => m.RoomComponent),
          },
          {
            path: 'artist-rooms/:seq',
            loadComponent: () =>
              import('../features/lobby/artist-game/artist-game.component').then(
                (m) => m.ArtistGameComponent,
              ),
          },
          {
            path: 'spyfall-rooms/:seq',
            loadComponent: () =>
              import('../features/lobby/spyfall-game/spyfall-game.component').then(
                (m) => m.SpyfallGameComponent,
              ),
          },
          {
            path: 'relay/:seq',
            loadComponent: () =>
              import('../features/lobby/relay-game/relay-game.component').then(
                (m) => m.RelayGameComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
