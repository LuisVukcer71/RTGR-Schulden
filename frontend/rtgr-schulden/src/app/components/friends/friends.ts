import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { FriendService, FriendItem, FriendStatistics } from '../../services/friend.service';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { CountUpDirective } from '../../directives/count-up.directive';

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
  private transactionService = inject(TransactionService);

  private readonly ringRadius = 42;

  friendsList: FriendItem[] = [];
  friendStats: FriendStatistics | null = null;
  transactions: Transaction[] = [];

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

    // Rohe Transaktionsliste für die client-seitig berechneten Zusatz-
    // Statistiken (Beglichen-Quote, Rangliste, Top-Anlässe, Highlights) -
    // derselbe geteilte Stream, den auch die Schulden-Übersicht nutzt, kein
    // eigener Backend-Endpunkt nötig.
    this.transactionService.transactions$.subscribe(data => {
      this.transactions = data;
      this.cdr.detectChanges();
    });

    // Daten vom Backend anfordern (idempotent, falls schon geladen einfach
    // ein Refresh - wichtig falls man direkt auf dem Freunde-Tab landet,
    // ohne vorher auf Schulden gewesen zu sein).
    this.friendService.loadFriends();
    this.friendService.loadStatistics();
    this.transactionService.loadTransactions();
  }

  isBalanced(balance: number): boolean {
    return Math.abs(balance) < BALANCE_EPSILON;
  }

  get totalBalance(): number {
    return this.friendsList.reduce((sum, friend) => sum + friend.balance, 0);
  }

  /** Freunde nach Relevanz sortiert (größter offener Saldo zuerst) statt in Backend-Reihenfolge. */
  get sortedFriendsList(): FriendItem[] {
    return [...this.friendsList].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
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

  // ---------- Top-Anlässe ----------

  /**
   * Nur eigene Ausgaben (type 'iOwe'), keine Forderungen. Vorher wurden
   * Beträge unabhängig von der Richtung aufsummiert - ein Anlass, der mal
   * "ich zahle" und mal "mir wird gezahlt" war, ergab eine Summe ohne reale
   * Bedeutung. "Top-Anlässe" soll zeigen, wofür DU dein Geld ausgibst.
   */
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

  /** Größte eigene Ausgabe - nur 'iOwe', sonst könnte hier fälschlich eine Forderung (jemand schuldet DIR) als "Ausgabe" auftauchen. */
  get biggestTransaction(): Transaction | null {
    const expenses = this.transactions.filter(t => t.type === 'iOwe');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, t) => (t.amount > max.amount ? t : max), expenses[0]);
  }

  get averageAmount(): number {
    return this.totalCount === 0 ? 0 : this.transactions.reduce((sum, t) => sum + t.amount, 0) / this.totalCount;
  }
}
