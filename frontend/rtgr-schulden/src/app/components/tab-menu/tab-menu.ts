import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bubble } from '../bubble/bubble'; // Pfad ggf. anpassen

export interface TabItem {
  id: string;
  label: string;
  iconPath: string; // SVG path data
}

@Component({
  selector: 'app-tab-menu',
  standalone: true,
  imports: [CommonModule, Bubble],
  templateUrl: './tab-menu.html',
  styleUrl: './tab-menu.css'
})
export class TabMenuComponent {
  @Input({ required: true }) tabs: TabItem[] = [];
  @Input() activeTabId: string = '';
  @Output() tabChange = new EventEmitter<string>();
  @Output() addClick = new EventEmitter<void>();

  /** Der Indikator bleibt ein einzelnes Element und gleitet zwischen Tabs,
   * statt beim Wechsel entfernt und am Ziel neu aufgebaut zu werden. */
  get activeTabIndex(): number {
    return Math.max(0, this.tabs.findIndex(tab => tab.id === this.activeTabId));
  }

  selectTab(tabId: string): void {
    if (this.activeTabId !== tabId) {
      this.activeTabId = tabId;
      this.tabChange.emit(tabId);
    }
  }

  onAddClicked() {
    this.addClick.emit();
  }
}
