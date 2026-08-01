import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

/** Reihenfolge der Bottom-Nav-Tabs - bestimmt die Swipe-Richtung beim Wechsel. */
const TAB_ORDER = ['expenses', 'friends', 'profile'];

function findTabPath(snapshot: ActivatedRouteSnapshot): string | null {
  let node: ActivatedRouteSnapshot | null = snapshot;
  while (node) {
    const path = node.routeConfig?.path;
    if (path && TAB_ORDER.includes(path)) return path;
    node = node.firstChild;
  }
  return null;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Native View-Transitions API für echte Seitenübergänge. Vor jedem
    // Übergang wird ermittelt, ob es sich um einen Tab-Wechsel handelt und
    // in welche Richtung - das steuert per Attribut auf <html>, ob CSS
    // (styles.css) nach links oder rechts swipt statt nur zu blenden.
    // Browser ohne Unterstützung navigieren einfach ohne Übergang weiter.
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: ({ from, to }) => {
          const fromTab = findTabPath(from);
          const toTab = findTabPath(to);
          const root = document.documentElement;

          if (fromTab && toTab && fromTab !== toTab) {
            const forward = TAB_ORDER.indexOf(toTab) > TAB_ORDER.indexOf(fromTab);
            root.setAttribute('data-nav-direction', forward ? 'forward' : 'backward');
          } else {
            root.removeAttribute('data-nav-direction');
          }
        }
      })
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations()
  ]
};