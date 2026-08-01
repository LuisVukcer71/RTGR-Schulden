import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({
  selector: '[reveal]',
  standalone: true
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input() revealDelay = 0;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.el.nativeElement;
    el.style.setProperty('--reveal-delay', `${this.revealDelay}ms`);
    el.classList.add('reveal-item');

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal-item--visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -16px 0px' }
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
