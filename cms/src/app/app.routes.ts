import { Routes } from '@angular/router';
export const routes: Routes = [
  {path: 'seedTypes', loadComponent: () => import('./pages/seedTypes/seed-types.component').then(m => m.SeedTypesPageComponent)},
  {path: 'cubeChannels', loadComponent: () => import('./pages/cubeChannels/cube-channels.component').then(m => m.CubeChannelsPageComponent)},
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'login', loadComponent: () => import('./shared/login/login.component').then(m => m.LoginComponent) },
  { path: 'seed-import', loadComponent: () => import('./pages/seed-import/seed-import.component').then(m => m.SeedImportPageComponent) },
  { path: 'tasks', loadComponent: () => import('./pages/tasks/tasks.component').then(m => m.TasksPageComponent) },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'merchants',
    loadComponent: () =>
      import('./pages/merchants/merchants.component').then((m) => m.MerchantsPageComponent),
  },
  {
    path: 'trees',
    loadComponent: () => import('./pages/trees/trees.component').then((m) => m.TreesPageComponent),
  },
  {
    path: 'rewards',
    loadComponent: () =>
      import('./pages/rewards/rewards.component').then((m) => m.RewardsPageComponent),
  },
  {
    path: 'scenes',
    loadComponent: () =>
      import('./pages/scenes/scenes.component').then((m) => m.ScenesPageComponent),
  },
  {
    path: 'budget',
    loadComponent: () =>
      import('./pages/budget/budget.component').then((m) => m.BudgetPageComponent),
  },
  {
    path: 'ai',
    loadComponent: () => import('./pages/ai/ai.component').then((m) => m.AiPageComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
