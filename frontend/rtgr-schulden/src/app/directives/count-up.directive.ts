import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

/**
 * Lässt einen Geldbetrag beim Ändern animiert von seinem alten zum neuen
 * Wert "hochrollen" (Odometer-Effekt), statt einfach zu erscheinen -
 * banking-app-typisches Feedback, das signalisiert "hier hat sich gerade
 * wirklich etwas verändert". Formatiert selbst per CurrencyPipe (identisch
 * zur bisherigen `| currency:'EUR':'symbol':'1.2-2'`-Nutzung im Template),
 * damit die Zahl während der Animation nicht neu vom Change-Detection-Zyklus
 * überschrieben wird.
 */
@Directive({
  selector: '[countUp]',
  standalone: true,
  providers: [CurrencyPipe]
})
export class CountUpDirective implements OnChanges {
  @Input('countUp') value = 0;
  /** Wird nur bei Werten >= 0 vorangestellt, z.B. '+'. */
  @Input() countUpPrefixPositive = '';
  @Input() countUpDurationMs = 650;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly currencyPipe = inject(CurrencyPipe);

  private hasRenderedOnce = false;
  private animationFrameId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('value' in changes)) return;

    const previous = changes['value'].previousValue;
    const current = this.value;

    if (!this.hasRenderedOnce || previous === undefined || previous === null || Number.isNaN(previous)) {
      this.hasRenderedOnce = true;
      this.render(current);
      return;
    }

    if (previous === current) {
      this.render(current);
      return;
    }

    this.animateTo(previous, current);
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
    const sign = value >= 0 ? this.countUpPrefixPositive : '';
    const formatted = this.currencyPipe.transform(value, 'EUR', 'symbol', '1.2-2') ?? '';
    this.el.nativeElement.textContent = sign + formatted;
  }
}
