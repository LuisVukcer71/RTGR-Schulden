import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Native View-Transitions API: echte Seitenmorph-Übergänge zwischen
    // Routen (Tab-Wechsel, Login->Dashboard). Browser ohne Unterstützung
    // navigieren einfach ohne Übergang weiter - reines Progressive Enhancement.
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};