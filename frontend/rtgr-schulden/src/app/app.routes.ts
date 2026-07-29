import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { Dashboard} from './components/dashboard/dashboard'; // Dein Dashboard
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' }
];