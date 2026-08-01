import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  trigger, transition, style, animate, query, stagger
} from '@angular/animations';
import { Bubble } from '../bubble/bubble';
import { CurrencyPipe } from '@angular/common';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { CountUpDirective } from '../../directives/count-up.directive';
import { CategoryIconComponent } from '../category-icon/category-icon';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { SpinnerComponent } from '../spinner/spinner';

type SettlementAction = 'request' | 'confirm' | 'cancel' | 'reopen';

@Component({
  selector: 'app-ausgaben-uebersicht',
  imports: [Bubble, CurrencyPipe, CountUpDirective, CategoryIconComponent, SpinnerComponent],
  templateUrl: './ausgaben-uebersicht.html',
  styleUrls: ['./ausgaben-uebersicht.css'],
  animations: [
    /**
     * Staggered-Entrance für die Transaktionsliste:
     * - Beim Tab-/Filter-Wechsel (Zustandswechsel des Bindings) treten
     *   neue Items mit Stagger ein; verlassende faden schnell aus.
     * - Der erste Parameter des Bindings ist der Tab, der zweite der Filter,
     *   damit Angular jeden Tab-/Filterwechsel als eigenen Übergang erkennt.
     */
    trigger('listAnim', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(28, [
            animate(
              '250ms cubic-bezier(0.32, 0.72, 0, 1)',
              style({ opacity: 1, transform: 'translateY(0)' })
            )
          ])
        ], { optional: true }),
        query(':leave', [
          animate(
            '150ms ease-in',
            style({ opacity: 0, transform: 'translateX(-6px)' })
          )
        ], { optional: true })
      ])
    ])
  ]
})
export class AusgabenUebersichtComponent implements OnInit {
  activeTab: 'all' | 'owedToMe' | 'iOwe' = 'all';
  statusFilter: 'all' | 'open' | 'paid' = 'all';

  get activeSegmentIndex(): number {
    return this.activeTab === 'all' ? 0 : this.activeTab === 'owedToMe' ? 1 : 2;
  }

  /** Bindungs-State für [@listAnim]: ändert sich bei jedem Tab-/Filterwechsel. */
  get listAnimState(): string {
    return `${this.activeTab}:${this.statusFilter}`;
  }

  private cdr = inject(ChangeDetectorRef);
  private prefs = inject(UserPreferencesService);
  private destroyRef = inject(DestroyRef);

  transactions: Transaction[] = [];
  isLoading = false;

  /** Anzeige-Währung aus den Nutzer-Einstellungen statt hartkodiertem EUR. */
  currency = this.prefs.currency;

  /** Verhindert Doppel-Klicks auf denselben Settle-Button. */
  private pendingActionIds = new Set<string>();

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    this.transactionService.isLoading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(loading => {
      this.isLoading = loading;
      this.cdr.detectChanges();
    });

    this.transactionService.transactions$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.transactions = data;
      this.cdr.detectChanges();
    });

    this.transactionService.loadTransactions();

    this.prefs.currency$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(currency => {
      this.currency = currency;
      this.cdr.detectChanges();
    });
  }

  isActionPending(id: string): boolean {
    return this.pendingActionIds.has(id);
  }

  get currentList(): Transaction[] {
    return this.transactions.filter(item => {
      const matchesType = this.activeTab === 'all' || item.type === this.activeTab;
      const matchesStatus =
        this.statusFilter === 'all' ? true :
        this.statusFilter === 'open' ? !item.isPaid :
        item.isPaid;
      return matchesType && matchesStatus;
    });
  }

  handleSettleClick(item: Transaction, event: Event): void {
    event.stopPropagation();

    if (this.pendingActionIds.has(item.id)) return;

    if (item.isPaid) {
      this.performAction(item, 'reopen', {
        isPaid: false, pendingConfirmation: false, confirmationInitiatedByMe: false
      });
      return;
    }

    if (item.pendingConfirmation) {
      if (item.confirmationInitiatedByMe) {
        this.performAction(item, 'cancel', {
          pendingConfirmation: false, confirmationInitiatedByMe: false
        });
      } else {
        this.performAction(item, 'confirm', {
          isPaid: true, pendingConfirmation: false, confirmationInitiatedByMe: false
        });
      }
      return;
    }

    this.performAction(item, 'request', {
      pendingConfirmation: true, confirmationInitiatedByMe: true
    });
  }

  private performAction(
    item: Transaction,
    action: SettlementAction,
    optimisticChanges: Partial<Transaction>
  ): void {
    const previousState: Partial<Transaction> = {
      isPaid: item.isPaid,
      pendingConfirmation: item.pendingConfirmation,
      confirmationInitiatedByMe: item.confirmationInitiatedByMe
    };

    this.pendingActionIds.add(item.id);
    this.transactionService.updateTransactionState(item.id, optimisticChanges);

    const call$ =
      action === 'request' ? this.transactionService.requestSettlement(item.id) :
      action === 'confirm' ? this.transactionService.confirmSettlement(item.id) :
      action === 'cancel'  ? this.transactionService.cancelSettlementRequest(item.id) :
      this.transactionService.reopenTransaction(item.id);

    call$.subscribe({
      next: () => {
        this.pendingActionIds.delete(item.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`Fehler bei Aktion "${action}":`, err);
        this.pendingActionIds.delete(item.id);
        this.transactionService.updateTransactionState(item.id, previousState);
      }
    });
  }

  get totalBalance(): number {
    return this.transactions
      .filter(item => !item.isPaid)
      .reduce((sum, item) => {
        return item.type === 'owedToMe' ? sum + item.amount : sum - item.amount;
      }, 0);
  }
}
