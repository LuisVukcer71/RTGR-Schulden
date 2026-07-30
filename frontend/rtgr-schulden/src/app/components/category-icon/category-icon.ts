import { Component, Input } from '@angular/core';

/**
 * Zentrales Icon-Set für Rechnungs-Kategorien - ein Switch statt [innerHTML],
 * damit nichts durch Angulars Sanitizer muss und die Pfade an einer Stelle
 * gepflegt werden (Kategorie-Chips im Rechnungs-Formular, Icon auf den
 * Transaktions-Karten).
 */
@Component({
  selector: 'app-category-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;display:block">
      @switch (categoryId) {
        @case ('food') {
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        }
        @case ('shopping') {
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        }
        @case ('transport') {
          <rect x="3" y="9" width="18" height="8" rx="2"/>
          <circle cx="7.5" cy="18.5" r="1.5"/>
          <circle cx="16.5" cy="18.5" r="1.5"/>
          <path d="M5 9l2-4h10l2 4"/>
        }
        @case ('home') {
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        }
        @case ('leisure') {
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
          <line x1="7" y1="2" x2="7" y2="22"/>
          <line x1="17" y1="2" x2="17" y2="22"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <line x1="2" y1="7" x2="7" y2="7"/>
          <line x1="2" y1="17" x2="7" y2="17"/>
          <line x1="17" y1="17" x2="22" y2="17"/>
          <line x1="17" y1="7" x2="22" y2="7"/>
        }
        @case ('travel') {
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        }
        @default {
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
          <circle cx="5" cy="12" r="1"/>
        }
      }
    </svg>
  `,
  // Host wird per Font-Size von außen skaliert (1em) und per `color`
  // eingefärbt (stroke="currentColor") - display:contents würde den Host
  // aus dem Layout nehmen und Größe/Farbe könnten von außen nicht mehr
  // gesetzt werden, da Angulars View Encapsulation verhindert, dass
  // Eltern-Stylesheets das innere <svg> eines Kind-Components direkt
  // erreichen.
  host: {
    '[style.display]': "'inline-flex'",
    '[style.width]': "'1em'",
    '[style.height]': "'1em'",
    '[style.flex-shrink]': "'0'"
  }
})
export class CategoryIconComponent {
  @Input() categoryId: string | null = null;
}
