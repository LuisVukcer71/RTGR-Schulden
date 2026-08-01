import { Directive, ElementRef, HostListener, Input, OnInit, inject } from '@angular/core';

@Directive({
  selector: '[tilt]',
  standalone: true
})
export class TiltDirective implements OnInit {
  @Input() tiltMax = 6;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private canHover = false;

  ngOnInit(): void {
    this.canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (this.canHover) {
      this.el.nativeElement.style.willChange = 'transform';
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.canHover) return;
    const el = this.el.nativeElement;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    el.style.transition = 'none';
    el.style.transform = `perspective(800px) rotateY(${x * this.tiltMax}deg) rotateX(${-y * this.tiltMax}deg)`;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.canHover) return;
    const el = this.el.nativeElement;
    el.style.transition = `transform var(--dur-quick, 180ms) var(--ease, ease)`;
    el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  }
}
