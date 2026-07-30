import { Injectable } from '@angular/core';

/**
 * Ein einziger, rAF-gedrosselter window:scroll-Listener für die ganze App
 * (ersetzt mehrere unabhängige HostListener('window:scroll') in Dashboard
 * und den Screen-Components). Schreibt einen kontinuierlichen Fortschritt
 * (0 = ganz oben, 1 = voll "gescrollt") direkt als CSS Custom Property auf
 * <html>. Jede Komponente kann darüber per calc(var(--scroll-progress))
 * reagieren - ganz ohne eigene Subscription oder Change Detection, und
 * ohne dass jede Komponente einen eigenen Scroll-Handler mitschleppt.
 */
@Injectable({
  providedIn: 'root'
})
export class ScrollProgressService {
  /** Scroll-Distanz in px, über die der Effekt von 0 auf 1 läuft. */
  private readonly rangePx = 70;

  private ticking = false;
  private started = false;

  /** Muss einmalig (z.B. im Dashboard-Shell) aufgerufen werden, um den Listener zu starten. */
  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.applyProgress();
  }

  private onScroll = (): void => {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.applyProgress();
      this.ticking = false;
    });
  };

  private applyProgress(): void {
    const y = window.scrollY;
    const progress = Math.min(Math.max(y / this.rangePx, 0), 1);
    document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4));
  }
}
