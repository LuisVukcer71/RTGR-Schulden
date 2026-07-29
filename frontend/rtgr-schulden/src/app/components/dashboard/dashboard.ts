import { Component, HostListener, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabMenuComponent, TabItem } from '../tab-menu/tab-menu';
import { AddBillComponent } from '../add-bill/add-bill'; 
import { AusgabenUebersichtComponent } from '../ausgaben-uebersicht/ausgaben-uebersicht'; 
import { FriendsComponent } from '../friends/friends';
import { ProfileComponent } from "../profile/profile";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TabMenuComponent, AusgabenUebersichtComponent, AddBillComponent, FriendsComponent, ProfileComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})

export class Dashboard {
  private cdr = inject(ChangeDetectorRef);

  isAddBillModalOpen = false;
  activeTab = 'expenses';
  isScrolled = false;

  navTabs = [
    { id: 'expenses', label: 'Schulden', iconPath: 'M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z' },
    { id: 'friends', label: 'Freunde', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'profile', label: 'Profil', iconPath: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }
  ];

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const newState = scrollPosition > 30;
    if (this.isScrolled !== newState) {
      this.isScrolled = newState;
      this.cdr.detectChanges();
    }
  }

  onTabChanged(tabId: string) {
    this.activeTab = tabId;
    this.cdr.detectChanges();
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