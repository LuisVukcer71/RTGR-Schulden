import { Component, ChangeDetectorRef, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { TabMenuComponent } from '../tab-menu/tab-menu';
import { AddBillComponent } from '../add-bill/add-bill';
import { ScrollStateService } from '../../services/scroll-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TabMenuComponent, AddBillComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private scrollState = inject(ScrollStateService);
  private routerEventsSub?: Subscription;

  isAddBillModalOpen = false;
  activeTab = 'expenses';

  navTabs = [
    { id: 'expenses', label: 'Schulden', iconPath: 'M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z' },
    { id: 'friends', label: 'Freunde', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'profile', label: 'Profil', iconPath: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }
  ];

  ngOnInit(): void {
    this.updateActiveTabFromUrl();
    this.routerEventsSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateActiveTabFromUrl();
        this.cdr.detectChanges();
      });

    // Ein einziger, geteilter Scroll-Listener für die ganze App (statt pro
    // Screen ein eigener) - setzt nur die .is-scrolled-Klasse auf <html>,
    // die eigentliche Animation (Saldo-Hero) übernimmt reines CSS.
    this.scrollState.start();
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
  }

  private updateActiveTabFromUrl(): void {
    const lastSegment = this.router.url.split('/').pop()?.split('?')[0] ?? '';
    if (this.navTabs.some(tab => tab.id === lastSegment)) {
      this.activeTab = lastSegment;
    }
  }

  onTabChanged(tabId: string) {
    this.router.navigate(['/dashboard', tabId]);
  }

  openAddBillModal() {
    this.isAddBillModalOpen = true;
    this.cdr.detectChanges(); // Öffnet das Menü sofort ohne Scroll-Zwang!
  }

  closeAddBillModal() {
    this.isAddBillModalOpen = false;
    this.cdr.detectChanges(); // Schließt das Menü sofort!
  }
}
