import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Bubble } from '../bubble/bubble';
import { FriendService, FriendItem, FriendStatistics } from '../../services/friend.service';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { CountUpDirective } from '../../directives/count-up.directive';
import { RevealDirective } from '../../directives/reveal.directive';
import { TiltDirective } from '../../directives/tilt.directive';
import { SpinnerComponent } from '../spinner/spinner';

/** Toleranz für Geldbeträge: Rundungsreste (z.B. 0.004) gelten als ausgeglichen. */
const BALANCE_EPSILON = 0.005;

interface ReasonStat {
  reason: string;
  count: number;
  total: number;
}

interface PartnerStat {
  name: string;
  count: number;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #0ea5e9, #2563eb)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #f43f5e, #be123c)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #6366f1, #4338ca)',
];

@Component({
  selector: 'app-friends',
  imports: [Bubble, CountUpDirective, RevealDirective, TiltDirective, SpinnerComponent],
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
  private transactionService = inject(TransactionService);
  private destroyRef = inject(DestroyRef);

  private readonly ringRadius = 42;

  friendsList: FriendItem[] = [];
  friendStats: FriendStatistics | null = null;
  transactions: Transaction[] = [];
  isLoading = false;

  /** Konfetti-Stücke für die "Alles ausgeglichen"-Animation. */
  readonly confettiIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  /**
   * Steuert, ob Ring-Offset und Balken-Breiten auf ihren echten Wert gesetzt
   * sind. Wird bei jedem Wechsel auf den Stats-Tab kurz auf false gesetzt,
   * damit die CSS-Transition den Weg von 0 zum Zielwert animiert.
   */
  private statsReady = false;

  ngOnInit(): void {
    this.friendService.isLoading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(loading => {
      this.isLoading = loading;
      this.cdr.detectChanges();
    });

    this.friendService.friends$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.friendsList = data;
      this.cdr.detectChanges();
    });

    this.friendService.stats$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.friendStats = data;
      this.cdr.detectChanges();
    });

    this.transactionService.transactions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.transactions = data;
      this.cdr.detectChanges();
    });

    this.friendService.loadFriends();
    this.friendService.loadStatistics();
    this.transactionService.loadTransactions();
  }

  setTab(tab: 'persons' | 'stats'): void {
    this.activeTab = tab;
    if (tab === 'stats') {
      this.statsReady = false;
      this.cdr.detectChanges();
      requestAnimationFrame(() => {
        this.statsReady = true;
        this.cdr.detectChanges();
      });
    }
  }

  isBalanced(balance: number): boolean {
    return Math.abs(balance) < BALANCE_EPSILON;
  }

  get isAllSettled(): boolean {
    return this.friendsList.length > 0 &&
           this.friendsList.every(f => this.isBalanced(f.balance));
  }

  get totalBalance(): number {
    return this.friendsList.reduce((sum, f) => sum + f.balance, 0);
  }

  get sortedFriendsList(): FriendItem[] {
    return [...this.friendsList].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }

  avatarGradient(name: string): string {
    const idx = Math.abs(name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
  }

  // ---------- Beglichen-Quote ----------

  get settledCount(): number {
    return this.transactions.filter(t => t.isPaid).length;
  }

  get totalCount(): number {
    return this.transactions.length;
  }

  get settlementRate(): number {
    return this.totalCount === 0 ? 0 : Math.round((this.settledCount / this.totalCount) * 100);
  }

  get ringCircumference(): number {
    return 2 * Math.PI * this.ringRadius;
  }

  get ringOffset(): number {
    return this.ringCircumference * (1 - this.settlementRate / 100);
  }

  get displayRingOffset(): number {
    return this.statsReady ? this.ringOffset : this.ringCircumference;
  }

  // ---------- Saldo-Rangliste ----------

  get rankedFriends(): FriendItem[] {
    return [...this.friendsList]
      .filter(f => !this.isBalanced(f.balance))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }

  get maxAbsBalance(): number {
    return Math.max(1, ...this.rankedFriends.map(f => Math.abs(f.balance)));
  }

  barWidthPercent(balance: number): number {
    return Math.min(100, (Math.abs(balance) / this.maxAbsBalance) * 100);
  }

  barDisplayWidth(balance: number): number {
    return this.statsReady ? this.barWidthPercent(balance) : 0;
  }

  // ---------- Top-Anlässe ----------

  get topReasons(): ReasonStat[] {
    const byReason = new Map<string, ReasonStat>();
    for (const t of this.transactions) {
      if (t.type !== 'iOwe') continue;
      const key = t.reason.trim().toLowerCase();
      if (!key) continue;
      const entry = byReason.get(key) ?? { reason: t.reason.trim(), count: 0, total: 0 };
      entry.count++;
      entry.total += t.amount;
      byReason.set(key, entry);
    }
    return Array.from(byReason.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }

  // ---------- Highlights ----------

  get topPartner(): PartnerStat | null {
    const byPerson = new Map<string, number>();
    for (const t of this.transactions) {
      byPerson.set(t.person, (byPerson.get(t.person) ?? 0) + 1);
    }
    let best: PartnerStat | null = null;
    for (const [name, count] of byPerson) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  }

  get biggestTransaction(): Transaction | null {
    const expenses = this.transactions.filter(t => t.type === 'iOwe');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, t) => (t.amount > max.amount ? t : max), expenses[0]);
  }

  get averageAmount(): number {
    return this.totalCount === 0 ? 0 : this.transactions.reduce((sum, t) => sum + t.amount, 0) / this.totalCount;
  }
}
