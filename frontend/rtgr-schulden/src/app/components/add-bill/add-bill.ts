import { Component, EventEmitter, Output, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-add-bill',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './add-bill.html',
  styleUrls: ['./add-bill.css']
})
export class AddBillComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private transactionService = inject(TransactionService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  title: string = '';
  totalAmount: number | null = null;
  paidBy: string = 'Ich';

  friends: string[] = [];
  selectedParticipants: string[] = ['Ich'];

  isSubmitting: boolean = false;
  errorMessage: string = '';

  /** Spielt die Schließen-Animation ab, bevor die Component tatsächlich entfernt wird. */
  isClosing: boolean = false;
  private readonly closeAnimationMs = 200; // deckt sich mit --dur-fast in styles.css

  ngOnInit(): void {
    this.loadRegisteredFriends();
  }

  loadRegisteredFriends(): void {
    const currentUser = this.authService.getCurrentUser();

    this.authService.getUsers().subscribe({
      next: (users) => {
        this.friends = users
          .filter(u => u.username !== currentUser?.username)
          .map(u => u.username);

        // Zwingt Angular, die Chips SOFORT anzuzeigen
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Fehler beim Laden der User:', err);
        this.errorMessage = 'Fehler beim Laden der Benutzer.';
        this.cdr.detectChanges();
      }
    });
  }

  selectPayer(payer: string): void {
    this.paidBy = payer;
    this.cdr.detectChanges();
  }

  toggleParticipant(friend: string): void {
    const index = this.selectedParticipants.indexOf(friend);
    if (index > -1) {
      this.selectedParticipants.splice(index, 1);
    } else {
      this.selectedParticipants.push(friend);
    }

    // Zwingt Angular dazu, den Aktiv-Zustand der Chips sofort darzustellen
    this.cdr.detectChanges();
  }

  get perPersonShare(): number {
    if (!this.totalAmount || this.selectedParticipants.length === 0) return 0;
    return Number((this.totalAmount / this.selectedParticipants.length).toFixed(2));
  }

  submitBill(): void {
    this.errorMessage = '';

    if (!this.title.trim() || !this.totalAmount || this.selectedParticipants.length === 0) {
      this.errorMessage = 'Bitte alle Felder ausfüllen und mindestens einen Beteiligten auswählen.';
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
    const billData = {
      title: this.title,
      totalAmount: this.totalAmount,
      paidBy: this.paidBy,
      participants: this.selectedParticipants,
      date: 'Heute'
    };

    this.transactionService.splitBill(billData).subscribe({
      next: () => {
        this.isSubmitting = false;
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