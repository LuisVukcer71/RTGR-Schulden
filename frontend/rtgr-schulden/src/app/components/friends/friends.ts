import { Component, HostListener, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { CurrencyPipe } from '@angular/common';
import { FriendService, FriendItem, FriendStatistics } from '../../services/friend.service';

@Component({
  selector: 'app-friends',
  imports: [Bubble, CurrencyPipe],
  templateUrl: './friends.html',
  styleUrls: ['./friends.css']
})
export class FriendsComponent implements OnInit {
  activeTab: 'persons' | 'stats' = 'persons';
  isScrolled = false;
  private isAutoScrolling = false;

  private cdr = inject(ChangeDetectorRef);
  private friendService = inject(FriendService);

  friendsList: FriendItem[] = [];
  friendStats: FriendStatistics | null = null;

  ngOnInit(): void {
    // Auf Freunde-Daten abonnieren
    this.friendService.friends$.subscribe(data => {
      this.friendsList = data;
      this.cdr.detectChanges();
    });

    // Auf Statistiken abonnieren
    this.friendService.stats$.subscribe(data => {
      this.friendStats = data;
      this.cdr.detectChanges();
    });

    // Daten vom Backend anfordern
    this.friendService.loadFriends();
    this.friendService.loadStatistics();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    const scrollY = window.scrollY;

    if (scrollY > 40 && !this.isScrolled && !this.isAutoScrolling) {
      this.isScrolled = true;
      this.isAutoScrolling = true;
      this.cdr.detectChanges();

      window.scrollTo({
        top: 100,
        behavior: 'smooth'
      });

      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 400);
    }
    else if (scrollY <= 15 && this.isScrolled && !this.isAutoScrolling) {
      this.isScrolled = false;
      this.cdr.detectChanges();
    }
  }

  get totalBalance(): number {
    return this.friendsList.reduce((sum, friend) => sum + friend.balance, 0);
  }
}