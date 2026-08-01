import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FriendItem {
  id: string;
  name: string;
  balance: number;
}

export interface FriendStatistics {
  totalSpent: number;
  totalReceived: number;
  activeFriendsCount: number;
  
}

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private http = inject(HttpClient);
  
  private apiUrl = `${environment.apiUrl}/friends`;

  private friendsSubject = new BehaviorSubject<FriendItem[]>([]);
  friends$ = this.friendsSubject.asObservable();

  private statsSubject = new BehaviorSubject<FriendStatistics | null>(null);
  stats$ = this.statsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.loadingSubject.asObservable();

  /**
   * Setzt den zwischengespeicherten State zurück. Ohne das würde beim
   * Account-Wechsel im selben Browser-Tab (Logout -> anderer Login) kurz
   * noch die Freundesliste/Statistik des VORHERIGEN Users angezeigt, weil
   * BehaviorSubjects neuen Abonnenten sofort ihren letzten Wert liefern -
   * spiegelt TransactionService.resetState().
   */
  resetState(): void {
    this.friendsSubject.next([]);
    this.statsSubject.next(null);
    this.loadingSubject.next(false);
  }

  loadFriends(): void {
    if (this.friendsSubject.getValue().length === 0) {
      this.loadingSubject.next(true);
    }
    this.http.get<FriendItem[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.friendsSubject.next(data);
        this.loadingSubject.next(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Freunde:', err);
        this.loadingSubject.next(false);
      }
    });
  }

  loadStatistics(): void {
    this.http.get<FriendStatistics>(`${this.apiUrl}/statistics`).subscribe({
      next: (data) => this.statsSubject.next(data),
      error: (err) => console.error('Fehler beim Laden der Statistiken:', err)
    });
  }
}