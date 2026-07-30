import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { CurrencyPipe } from '@angular/common';
import { TransactionService, Transaction } from '../../services/transaction.service';
import { CountUpDirective } from '../../directives/count-up.directive';

type SettlementAction = 'request' | 'confirm' | 'cancel' | 'reopen';

@Component({
  selector: 'app-ausgaben-uebersicht',
  imports: [Bubble, CurrencyPipe, CountUpDirective],
  templateUrl: './ausgaben-uebersicht.html',
  styleUrls: ['./ausgaben-uebersicht.css']
})
export class AusgabenUebersichtComponent implements OnInit {
  activeTab: 'all' | 'owedToMe' | 'iOwe' = 'all';
  statusFilter: 'all' | 'open' | 'paid' = 'all';

  get activeSegmentIndex(): number {
    return this.activeTab === 'all' ? 0 : this.activeTab === 'owedToMe' ? 1 : 2;
  }

  private cdr = inject(ChangeDetectorRef);

  // Nicht mehr hartcodiert: kommt jetzt live über den TransactionService,
  // damit neu gesplittete Rechnungen sofort in der Liste erscheinen.
  transactions: Transaction[] = [];

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    // Auf zentralen State abonnieren...
    this.transactionService.transactions$.subscribe(data => {
      this.transactions = data;
      // Ohne diesen Aufruf wird die View erst beim nächsten "zufälligen"
      // Change-Detection-Trigger aktualisiert, da die App zoneless läuft
      // und async Subscriptions nicht automatisch eine Neu-Prüfung der
      // View auslösen.
      this.cdr.detectChanges();
    });
    // ...und initial vom Backend laden.
    this.transactionService.loadTransactions();
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

  /**
   * Zentrale Klick-Logik für den Settle-Button. Leitet je nach
   * aktuellem Zustand der Transaktion die richtige Aktion ein:
   *
   *   bezahlt            -> reopen  (wieder öffnen)
   *   wartet auf Partner  -> cancel  (ich habe angefragt -> zurückziehen)
   *   Partner wartet auf mich -> confirm (ich bestätige)
   *   offen               -> request (Bestätigung anfragen)
   */
  handleSettleClick(item: Transaction, event: Event): void {
    event.stopPropagation();

    if (item.isPaid) {
      this.performAction(item, 'reopen', {
        isPaid: false,
        pendingConfirmation: false,
        confirmationInitiatedByMe: false
      });
      return;
    }

    if (item.pendingConfirmation) {
      if (item.confirmationInitiatedByMe) {
        // Eigene Anfrage zurückziehen.
        this.performAction(item, 'cancel', {
          pendingConfirmation: false,
          confirmationInitiatedByMe: false
        });
      } else {
        // Anfrage der Gegenseite bestätigen -> jetzt wirklich abgehakt.
        this.performAction(item, 'confirm', {
          isPaid: true,
          pendingConfirmation: false,
          confirmationInitiatedByMe: false
        });
      }
      return;
    }

    // Normalfall: Bestätigung anfragen.
    this.performAction(item, 'request', {
      pendingConfirmation: true,
      confirmationInitiatedByMe: true
    });
  }

  /**
   * Führt eine Settlement-Aktion optimistisch aus (UI reagiert sofort)
   * und rollt bei einem Server-Fehler den vorherigen Zustand zurück,
   * damit UI und Backend nicht auseinanderlaufen.
   */
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

    Object.assign(item, optimisticChanges);
    this.cdr.detectChanges();

    const call$ =
      action === 'request' ? this.transactionService.requestSettlement(item.id) :
      action === 'confirm' ? this.transactionService.confirmSettlement(item.id) :
      action === 'cancel' ? this.transactionService.cancelSettlementRequest(item.id) :
      this.transactionService.reopenTransaction(item.id);

    call$.subscribe({
      error: (err) => {
        console.error(`Fehler bei Aktion "${action}":`, err);
        Object.assign(item, previousState); // Rollback
        this.cdr.detectChanges();
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
