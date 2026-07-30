import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Transaction {
  id: string;
  person: string;
  reason: string;
  date: string;
  category: string | null;
  amount: number;
  isPaid: boolean;
  type: 'owedToMe' | 'iOwe';
  // Feature: gegenseitige Bestätigung beim Abhaken.
  // pendingConfirmation: es liegt eine offene Anfrage vor (weder isPaid
  //   noch abgelehnt/zurückgezogen).
  // confirmationInitiatedByMe: true, wenn ICH diese Anfrage gestellt habe
  //   (ich warte auf die Gegenseite) - false, wenn die Gegenseite sie
  //   gestellt hat und ICH jetzt bestätigen müsste.
  pendingConfirmation: boolean;
  confirmationInitiatedByMe: boolean;
}

export interface SplitBillPayload {
  title: string;
  totalAmount: number;
  paidBy: string;
  participants: string[];
  date?: string;
  category?: string | null;
  /** Explizite Beträge pro Teilnehmer (Schlüssel = derselbe String wie in
   *  `participants`, inkl. 'Ich'). Wird weggelassen für Gleich-Aufteilung. */
  customSplits?: Record<string, number>;
}

type SettlementAction = 'request' | 'confirm' | 'cancel' | 'reopen';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = environment.apiUrl;

  // Single Source of Truth: alle Komponenten abonnieren transactions$
  // statt eigene, lokale Kopien der Liste zu halten.
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  readonly transactions$ = this.transactionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Lädt die aktuelle Transaktionsliste vom Backend und
   * pusht sie an alle Abonnenten von transactions$.
   */
  loadTransactions(): void {
    this.http.get<Transaction[]>(`${this.apiUrl}/transactions`).subscribe({
      next: (data) => this.transactionsSubject.next(data),
      error: (err) => console.error('Fehler beim Laden der Transaktionen:', err)
    });
  }

  /**
   * Setzt den zwischengespeicherten State zurück (leere Liste).
   * Wird von AuthService bei login()/logout() aufgerufen, damit beim
   * Account-Wechsel im selben Browser-Tab keine Daten des vorherigen
   * Users sichtbar bleiben (dieser Service ist providedIn:'root' und
   * bleibt sonst über die gesamte Lebensdauer der SPA als Singleton
   * bestehen).
   */
  resetState(): void {
    this.transactionsSubject.next([]);
  }

  /**
   * Rechnung aufteilen. Lädt nach erfolgreichem Split automatisch
   * die Transaktionsliste neu, damit die UI sofort konsistent ist.
   */
  splitBill(billData: SplitBillPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/bills`, billData).pipe(
      tap(() => this.loadTransactions())
    );
  }

  /**
   * Interner Helper: ruft die gemeinsame Settlement-Route mit der
   * jeweiligen Aktion auf und lädt danach die Liste neu.
   */
  private updateSettlement(id: string, action: SettlementAction): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.apiUrl}/transactions/${id}/settlement`, { action }).pipe(
      tap(() => this.loadTransactions())
    );
  }

  /** Ich markiere eine offene Schuld als bezahlt -> Gegenseite muss bestätigen. */
  requestSettlement(id: string): Observable<Transaction> {
    return this.updateSettlement(id, 'request');
  }

  /** Ich bestätige die Anfrage der Gegenseite -> Schuld gilt jetzt endgültig als bezahlt. */
  confirmSettlement(id: string): Observable<Transaction> {
    return this.updateSettlement(id, 'confirm');
  }

  /** Ich ziehe meine eigene, noch offene Anfrage zurück. */
  cancelSettlementRequest(id: string): Observable<Transaction> {
    return this.updateSettlement(id, 'cancel');
  }

  /** Eine bereits als bezahlt bestätigte Schuld wieder öffnen. */
  reopenTransaction(id: string): Observable<Transaction> {
    return this.updateSettlement(id, 'reopen');
  }

  /**
   * Einzelne Transaktion manuell anlegen (bestehende Funktionalität,
   * falls an anderer Stelle im Projekt bereits genutzt).
   */
  createTransaction(payload: Omit<Transaction, 'id' | 'isPaid' | 'pendingConfirmation' | 'confirmationInitiatedByMe'>): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, payload).pipe(
      tap(() => this.loadTransactions())
    );
  }

  deleteTransaction(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/transactions/${id}`).pipe(
      tap(() => this.loadTransactions())
    );
  }
}