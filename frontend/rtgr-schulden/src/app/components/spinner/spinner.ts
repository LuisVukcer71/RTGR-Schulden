import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <div class="sp" role="status" aria-label="Lädt …"
         [style.width.px]="size" [style.height.px]="size">
      <svg [attr.viewBox]="'0 0 44 44'" [attr.width]="size" [attr.height]="size">
        <circle class="sp-track" cx="22" cy="22" r="18"/>
        <circle class="sp-arc"   cx="22" cy="22" r="18"/>
      </svg>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }
    .sp { animation: sp-spin 1.2s linear infinite; will-change: transform; }
    .sp-track { fill: none; stroke: rgba(255,255,255,.07); stroke-width: 3.5; }
    .sp-arc {
      fill: none; stroke: #38bdf8; stroke-width: 3.5;
      stroke-linecap: round; stroke-dasharray: 70 44;
    }
    @keyframes sp-spin { to { transform: rotate(360deg); } }
  `]
})
export class SpinnerComponent {
  @Input() size = 28;
}
