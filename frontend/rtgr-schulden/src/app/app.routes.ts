import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { Dashboard } from './components/dashboard/dashboard';
import { AusgabenUebersichtComponent } from './components/ausgaben-uebersicht/ausgaben-uebersicht';
import { FriendsComponent } from './components/friends/friends';
import { ProfileComponent } from './components/profile/profile';
import { authGuard } from './guards/auth-guard';
import { guestGuard } from './guards/guest-guard';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'expenses', pathMatch: 'full' },
      { path: 'expenses', component: AusgabenUebersichtComponent },
      { path: 'friends', component: FriendsComponent },
      { path: 'profile', component: ProfileComponent }
    ]
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' }
];