import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { FriendService, FriendItem, FriendStatistics } from '../../services/friend.service';
import { CountUpDirective } from '../../directives/count-up.directive';

/** Toleranz für Geldbeträge: Rundungsreste (z.B. 0.004) gelten als ausgeglichen. */
const BALANCE_EPSILON = 0.005;

@Component({
  selector: 'app-friends',
  imports: [Bubble, CountUpDirective],
  templateUrl: './friends.html',
  styleUrls: ['./friends.css']
})
export class FriendsComponent implements OnInit {
  activeTab: 'persons' | 'stats' = 'persons';

  get activeSegmentIndex(): number {
    return this.activeTab === 'persons' ? 0 : 1;
  }

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

  isBalanced(balance: number): boolean {
    return Math.abs(balance) < BALANCE_EPSILON;
  }

  get totalBalance(): number {
    return this.friendsList.reduce((sum, friend) => sum + friend.balance, 0);
  }
}
