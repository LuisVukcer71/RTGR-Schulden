import { Component, EventEmitter, Output, OnInit, OnDestroy, AfterViewInit, ElementRef, HostListener, inject, ChangeDetectorRef, ViewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService, SplitBillPayload } from '../../services/transaction.service';
import { AuthService } from '../../services/auth';
import { BILL_CATEGORIES, BillCategory } from '../../shared/bill-categories';
import { CategoryIconComponent } from '../category-icon/category-icon';
import { UserPreferencesService } from '../../services/user-preferences.service';

type SplitMode = 'equal' | 'exact' | 'percent';

interface LastBillConfig {
  paidBy: string;
  participants: string[];
  category: string | null;
}

const LAST_CONFIG_KEY = 'rtgr_last_bill_config';

@Component({
  selector: 'app-add-bill',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, CategoryIconComponent],
  templateUrl: './add-bill.html',
  styleUrls: ['./add-bill.css']
})
export class AddBillComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  /** Titel-Feld bekommt beim Öffnen automatisch den Fokus. */
  @ViewChild('titleInput') titleInputRef?: ElementRef<HTMLInputElement>;

  private transactionService = inject(TransactionService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private prefs = inject(UserPreferencesService);
  private hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** Element, das vor dem Öffnen fokussiert war (i.d.R. der "+"-Button) - bekommt beim Schließen den Fokus zurück. */
  private previouslyFocusedElement: HTMLElement | null = null;

  /** Anzeige-Währung aus den Nutzer-Einstellungen statt hartkodiertem EUR. */
  currency = this.prefs.currency;

  title: string = '';
  totalAmount: number | null = null;
  paidBy: string = 'Ich';
  category: string | null = null;
  readonly categories: BillCategory[] = BILL_CATEGORIES;

  friends: string[] = [];
  selectedParticipants: string[] = ['Ich'];

  splitMode: SplitMode = 'equal';
  customAmounts: Record<string, number> = {};
  customPercents: Record<string, number> = {};

  lastConfig: LastBillConfig | null = null;

  isSubmitting: boolean = false;
  errorMessage: string = '';

  isLoadingFriends: boolean = true;

  isClosing: boolean = false;
  private readonly closeAnimationMs = 300; // deckt sich mit --dur-normal in styles.css

  ngOnInit(): void {
    this.loadRegisteredFriends();
    this.loadLastConfig();

    this.prefs.currency$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(currency => {
      this.currency = currency;
      this.cdr.detectChanges();
    });

    this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
  }

  ngAfterViewInit(): void {
    // Erst nachdem die Sheet-Animation zu laufen begonnen hat fokussieren,
    // sonst "springt" die Seite beim Öffnen durch den Browser-Autoscroll-zu-
    // fokussiertem-Element-Mechanismus mitten in der Eintritts-Animation.
    setTimeout(() => this.titleInputRef?.nativeElement.focus(), 50);
  }

  ngOnDestroy(): void {
    this.previouslyFocusedElement?.focus?.();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeModal();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** Einfacher Fokus-Trap: Tab/Shift+Tab bleibt innerhalb der Sheet, statt in die Seite dahinter zu wandern. */
  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.hostElement.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  loadRegisteredFriends(): void {
    const currentUser = this.authService.getCurrentUser();

    this.authService.getUsers().subscribe({
      next: (users) => {
        this.friends = users
          .filter(u => u.username !== currentUser?.username)
          .map(u => u.username);

        this.isLoadingFriends = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Fehler beim Laden der User:', err);
        this.errorMessage = 'Fehler beim Laden der Benutzer.';
        this.isLoadingFriends = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- "Wie beim letzten Mal" ----------

  private loadLastConfig(): void {
    try {
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      this.lastConfig = raw ? JSON.parse(raw) : null;
    } catch {
      this.lastConfig = null;
    }
  }

  applyLastConfig(): void {
    if (!this.lastConfig) return;
    this.paidBy = this.lastConfig.paidBy;
    this.selectedParticipants = [...this.lastConfig.participants];
    this.category = this.lastConfig.category;
    if (this.splitMode !== 'equal') this.distributeEqually();
    this.cdr.detectChanges();
  }

  private saveLastConfig(): void {
    const config: LastBillConfig = {
      paidBy: this.paidBy,
      participants: this.selectedParticipants,
      category: this.category
    };
    try {
      localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
    } catch {
      // localStorage kann in seltenen Fällen (privater Modus, voller Speicher)
      // fehlschlagen - das "Wie beim letzten Mal"-Feature ist nur ein Komfort-
      // Extra, kein Grund, das Speichern der Rechnung selbst scheitern zu lassen.
    }
  }

  // ---------- Kategorie ----------

  selectCategory(id: string): void {
    this.category = this.category === id ? null : id;
    this.cdr.detectChanges();
  }

  // ---------- Teilnehmer ----------

  selectPayer(payer: string): void {
    this.paidBy = payer;
    this.cdr.detectChanges();
  }

  toggleParticipant(friend: string): void {
    const index = this.selectedParticipants.indexOf(friend);
    if (index > -1) {
      this.selectedParticipants.splice(index, 1);
      delete this.customAmounts[friend];
      delete this.customPercents[friend];
    } else {
      this.selectedParticipants.push(friend);
      if (!(friend in this.customAmounts)) this.customAmounts[friend] = 0;
      if (!(friend in this.customPercents)) this.customPercents[friend] = 0;
    }

    // Custom-Aufteilung ergibt erst ab 2 Beteiligten Sinn (siehe *ngIf im
    // Template) - fällt die Auswahl auf 1 zurück, muss der Split-Modus mit
    // zurückgesetzt werden. Sonst bliebe "exact"/"percent" aktiv, obwohl die
    // UI dafür ausgeblendet ist, und die Validierung würde stillschweigend
    // mit veralteten Werten weiterblocken, ohne dass der Grund sichtbar ist.
    if (this.selectedParticipants.length <= 1) {
      this.splitMode = 'equal';
    }

    // Zwingt Angular dazu, den Aktiv-Zustand der Chips sofort darzustellen
    this.cdr.detectChanges();
  }

  get perPersonShare(): number {
    if (!this.totalAmount || this.selectedParticipants.length === 0) return 0;
    return Number((this.totalAmount / this.selectedParticipants.length).toFixed(2));
  }

  // ---------- Split-Modus ----------

  selectSplitMode(mode: SplitMode): void {
    this.splitMode = mode;
    if (mode !== 'equal') this.distributeEqually();
    this.cdr.detectChanges();
  }

  /** Setzt Beträge/Prozente im aktuellen Custom-Modus wieder auf eine gleichmäßige Verteilung zurück. */
  distributeEqually(): void {
    const n = this.selectedParticipants.length;
    if (n === 0) return;

    if (this.splitMode === 'exact') {
      const totalCents = Math.round((this.totalAmount ?? 0) * 100);
      const base = Math.floor(totalCents / n);
      const remainder = totalCents - base * n;
      this.selectedParticipants.forEach((p, i) => {
        this.customAmounts[p] = (base + (i < remainder ? 1 : 0)) / 100;
      });
    } else if (this.splitMode === 'percent') {
      const baseHundredths = Math.floor(10000 / n);
      const remainder = 10000 - baseHundredths * n;
      this.selectedParticipants.forEach((p, i) => {
        this.customPercents[p] = (baseHundredths + (i < remainder ? 1 : 0)) / 100;
      });
    }

    this.cdr.detectChanges();
  }

  setCustomAmount(person: string, value: number): void {
    this.customAmounts[person] = Number(value) || 0;
  }

  setCustomPercent(person: string, value: number): void {
    this.customPercents[person] = Number(value) || 0;
  }

  get customAmountsSum(): number {
    return Number(this.selectedParticipants.reduce((sum, p) => sum + (Number(this.customAmounts[p]) || 0), 0).toFixed(2));
  }

  get customAmountsRemaining(): number {
    return Number(((this.totalAmount ?? 0) - this.customAmountsSum).toFixed(2));
  }

  get customPercentSum(): number {
    return Number(this.selectedParticipants.reduce((sum, p) => sum + (Number(this.customPercents[p]) || 0), 0).toFixed(2));
  }

  get customPercentRemaining(): number {
    return Number((100 - this.customPercentSum).toFixed(2));
  }

  get isCustomSplitBalanced(): boolean {
    if (this.splitMode === 'exact') return Math.abs(this.customAmountsRemaining) < 0.01;
    if (this.splitMode === 'percent') return Math.abs(this.customPercentRemaining) < 0.01;
    return true;
  }

  /**
   * Wandelt den aktuellen Split-Modus in die Beträge um, die ans Backend
   * gehen. Bei Prozenten wird nach der "größte-Bruchteile"-Methode auf ganze
   * Cent verteilt, damit die Summe exakt dem Gesamtbetrag entspricht (keine
   * Rundungsdrift wie bei einer naiven Prozent-zu-Cent-Umrechnung).
   */
  private buildCustomSplitsPayload(): Record<string, number> | undefined {
    if (this.splitMode === 'equal') return undefined;

    if (this.splitMode === 'exact') {
      const result: Record<string, number> = {};
      for (const p of this.selectedParticipants) result[p] = Number(this.customAmounts[p]) || 0;
      return result;
    }

    // percent
    const totalCents = Math.round((this.totalAmount ?? 0) * 100);
    const rawCents = this.selectedParticipants.map(p => ((Number(this.customPercents[p]) || 0) / 100) * totalCents);
    const flooredCents = rawCents.map(v => Math.floor(v));
    const usedCents = flooredCents.reduce((sum, v) => sum + v, 0);
    let remainder = totalCents - usedCents;

    const byFraction = rawCents
      .map((v, i) => ({ i, frac: v - flooredCents[i] }))
      .sort((a, b) => b.frac - a.frac);

    for (let k = 0; k < remainder && byFraction.length > 0; k++) {
      flooredCents[byFraction[k % byFraction.length].i]++;
    }

    const result: Record<string, number> = {};
    this.selectedParticipants.forEach((p, i) => (result[p] = flooredCents[i] / 100));
    return result;
  }

  submitBill(): void {
    this.errorMessage = '';

    if (!this.title.trim() || !this.totalAmount || this.selectedParticipants.length === 0) {
      this.errorMessage = 'Bitte alle Felder ausfüllen und mindestens einen Beteiligten auswählen.';
      return;
    }

    if (!this.isCustomSplitBalanced) {
      this.errorMessage = this.splitMode === 'percent'
        ? 'Die Prozente müssen sich zu 100% summieren.'
        : 'Die Beträge müssen sich zum Gesamtbetrag summieren.';
      return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();

    // WICHTIG: Der eingeloggte User wird NICHT mehr manuell mitgeschickt
    // (weder als currentUsername noch currentUserId). Das Backend liest
    // die User-Identität ausschließlich aus dem verifizierten Auth-Token
    // (siehe TransactionService / auth.interceptor.ts), das per
    // Authorization-Header automatisch mitgesendet wird. So kann sich
    // niemand über den Payload als anderer User ausgeben.
    const billData: SplitBillPayload = {
      title: this.title,
      totalAmount: this.totalAmount,
      paidBy: this.paidBy,
      participants: this.selectedParticipants,
      date: 'Heute',
      category: this.category,
      customSplits: this.buildCustomSplitsPayload()
    };

    this.transactionService.splitBill(billData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.saveLastConfig();
        this.requestClose();
      },
      error: (err) => {
        console.error('Fehler beim Speichern der Rechnung:', err);
        this.errorMessage = err.error?.error || 'Fehler beim Speichern der Rechnung.';
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeModal(): void {
    if (!this.isSubmitting) {
      this.requestClose();
    }
  }

  /** Spielt die Sheet/Backdrop-Exit-Animation ab, bevor die Component entfernt wird. */
  private requestClose(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => this.close.emit(), this.closeAnimationMs);
  }
}
