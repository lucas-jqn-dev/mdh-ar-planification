import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/signup/signup').then((m) => m.Signup),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'master_data',
        loadComponent: () => import('./pages/master-data/master-data').then((m) => m.MasterData),
      },
      {
        path: 'order_recepcions',
        loadComponent: () =>
          import('./pages/order-recepcions/order-recepcions').then((m) => m.OrderRecepcions),
      },
      {
        path: 'descargas',
        loadComponent: () => import('./pages/descargas/descargas').then((m) => m.Descargas),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
