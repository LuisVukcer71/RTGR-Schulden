import { Injectable } from '@angular/core';

/**
 * Ein einziger, leichtgewichtiger window:scroll-Listener für die ganze App
 * (ersetzt mehrere unabhängige HostListener('window:scroll') in Dashboard
 * und den Screen-Components). Schreibt NUR eine binäre Klasse auf <html>,
 * wenn sich der Zustand tatsächlich ändert - nicht kontinuierlich bei
 * jedem Scroll-Event.
 *
 * Ein pro-Frame aktualisierter numerischer Wert (frühere Version, CSS
 * Custom Property + calc()) hat sich auf dem Handy als spürbar ruckelig
 * erwiesen: die visuelle Änderung folgt dann exakt der oft unregelmäßigen
 * Scroll-Event-Taktung des Browsers. Diese Variante ändert das DOM nur
 * beim Zustandswechsel - die eigentliche Animation macht reines CSS
 * (transition auf .is-scrolled-Selektoren), dadurch immer flüssig,
 * unabhängig von der Scroll-Event-Frequenz.
 */
@Injectable({
  providedIn: 'root'
})
export class ScrollStateService {
  private started = false;
  private isScrolled = false;

  /** Muss einmalig (z.B. im Dashboard-Shell) aufgerufen werden, um den Listener zu starten. */
  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  private onScroll = (): void => {
    const scrolled = window.scrollY > 0;
    if (scrolled !== this.isScrolled) {
      this.isScrolled = scrolled;
      document.documentElement.classList.toggle('is-scrolled', scrolled);
    }
  };
}
