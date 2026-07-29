import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface FriendItem {
  id: string;
  name: string;
  balance: number;
}

export interface FriendStatistics {
  totalSpent: number;
  totalReceived: number;
  activeFriendsCount: number;
  // Füge hier weitere Statistik-Felder hinzu, je nachdem was dein Backend liefert
}

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private http = inject(HttpClient);
  
  // Passe die URL an dein Backend an
  private apiUrl = 'http://localhost:3000/api/friends'; 

  private friendsSubject = new BehaviorSubject<FriendItem[]>([]);
  friends$ = this.friendsSubject.asObservable();

  private statsSubject = new BehaviorSubject<FriendStatistics | null>(null);
  stats$ = this.statsSubject.asObservable();

  loadFriends(): void {
    this.http.get<FriendItem[]>(this.apiUrl).subscribe({
      next: (data) => this.friendsSubject.next(data),
      error: (err) => console.error('Fehler beim Laden der Freunde:', err)
    });
  }

  loadStatistics(): void {
    this.http.get<FriendStatistics>(`${this.apiUrl}/statistics`).subscribe({
      next: (data) => this.statsSubject.next(data),
      error: (err) => console.error('Fehler beim Laden der Statistiken:', err)
    });
  }
}