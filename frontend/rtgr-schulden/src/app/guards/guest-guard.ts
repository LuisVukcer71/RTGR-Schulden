import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Verhindert, dass ein bereits eingeloggter User erneut den Login-Screen
 * sieht - wichtig für die installierte App: beim Tippen auf das
 * Homescreen-Icon soll man direkt im Dashboard landen, nicht jedes Mal
 * neu am Login vorbeimüssen.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
