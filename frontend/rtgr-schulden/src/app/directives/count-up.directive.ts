import { Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { UserPreferencesService } from '../services/user-preferences.service';

/**
 * Lässt einen Geldbetrag beim Ändern animiert von seinem alten zum neuen
 * Wert "hochrollen" (Odometer-Effekt), statt einfach zu erscheinen -
 * banking-app-typisches Feedback, das signalisiert "hier hat sich gerade
 * wirklich etwas verändert". Formatiert selbst per CurrencyPipe (identisch
 * zur bisherigen `| currency:'EUR':'symbol':'1.2-2'`-Nutzung im Template),
 * damit die Zahl während der Animation nicht neu vom Change-Detection-Zyklus
 * überschrieben wird. Währung kommt live aus UserPreferencesService, nicht
 * hartkodiert.
 */
@Directive({
  selector: '[countUp]',
  standalone: true,
  providers: [CurrencyPipe]
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') value = 0;
  /** Wird nur bei Werten >= 0 vorangestellt, z.B. '+'. */
  @Input() countUpPrefixPositive = '';
  @Input() countUpDurationMs = 650;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly currencyPipe = inject(CurrencyPipe);
  private readonly prefs = inject(UserPreferencesService);

  private hasRenderedOnce = false;
  private animationFrameId: number | null = null;
  /** Der Wert, der GERADE auf dem Bildschirm steht (auch mitten in einer laufenden Animation). */
  private currentRenderedValue = 0;
  private readonly currencySub: Subscription;

  constructor() {
    // Ändert sich die Währung (Profil-Einstellung), muss der schon
    // gerenderte Betrag sofort im neuen Format angezeigt werden - ohne auf
    // die nächste Wertänderung zu warten.
    this.currencySub = this.prefs.currency$.subscribe(() => {
      if (this.hasRenderedOnce) this.render(this.currentRenderedValue);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!('value' in changes)) return;

    const current = this.value;

    if (!this.hasRenderedOnce) {
      this.hasRenderedOnce = true;
      this.render(current);
      return;
    }

    // Bewusst vom aktuell SICHTBAREN Wert aus animieren (currentRenderedValue),
    // nicht von changes['value'].previousValue: läuft schon eine Animation,
    // wenn der nächste Wertwechsel reinkommt, ist previousValue der Stand von
    // VOR der laufenden Animation - die Zahl würde sichtbar dorthin
    // zurückspringen, bevor sie neu losanimiert. So bleibt es ein einziger,
    // durchgehender Flug zum jeweils neuesten Ziel.
    const from = this.currentRenderedValue;
    if (from === current) {
      this.render(current);
      return;
    }

    this.animateTo(from, current);
  }

  ngOnDestroy(): void {
    this.currencySub.unsubscribe();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animateTo(from: number, to: number): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const start = performance.now();
    const duration = this.countUpDurationMs;

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      this.render(from + (to - from) * eased);

      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  private render(value: number): void {
    this.currentRenderedValue = value;
    const sign = value >= 0 ? this.countUpPrefixPositive : '';
    const formatted = this.currencyPipe.transform(value, this.prefs.currency, 'symbol', '1.2-2') ?? '';
    this.el.nativeElement.textContent = sign + formatted;
  }
}
