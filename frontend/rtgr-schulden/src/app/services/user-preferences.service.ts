import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const CURRENCY_CACHE_KEY = 'rtgr_pref_currency';
const REDUCE_MOTION_CACHE_KEY = 'rtgr_pref_reduce_motion';
const DEFAULT_CURRENCY = 'EUR';

/**
 * Zentrale Stelle für Anzeige-Präferenzen (Währung, "Bewegung reduzieren"),
 * die für die GESAMTE App gelten - nicht erst, wenn man zufällig den
 * Profil-Screen öffnet. Beide Werte werden aus localStorage vorbelegt
 * (sofort beim App-Start korrekt, kein Aufblitzen des Standardzustands)
 * und von AuthService einmal pro Session live vom Server nachgeladen.
 */
@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly currencySubject = new BehaviorSubject<string>(this.readCache(CURRENCY_CACHE_KEY) ?? DEFAULT_CURRENCY);
  readonly currency$ = this.currencySubject.asObservable();

  constructor() {
    // Läuft synchron beim ersten Zugriff auf den Service (App-Root injiziert
    // ihn bewusst früh) - die Klasse steht damit, bevor überhaupt die erste
    // Animation starten könnte.
    this.applyReduceMotion(this.readCache(REDUCE_MOTION_CACHE_KEY) === '1');
  }

  get currency(): string {
    return this.currencySubject.value;
  }

  setCurrency(currency: string | null | undefined): void {
    const next = currency || DEFAULT_CURRENCY;
    if (next !== this.currencySubject.value) this.currencySubject.next(next);
    this.writeCache(CURRENCY_CACHE_KEY, next);
  }

  setReduceMotion(enabled: boolean): void {
    this.applyReduceMotion(enabled);
    this.writeCache(REDUCE_MOTION_CACHE_KEY, enabled ? '1' : '0');
  }

  private applyReduceMotion(enabled: boolean): void {
    document.documentElement.classList.toggle('app-reduce-motion', enabled);
  }

  private readCache(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeCache(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Privater Modus/voller Speicher - reine Komfort-Vorbelegung, kein Grund zum Abbruch.
    }
  }
}
