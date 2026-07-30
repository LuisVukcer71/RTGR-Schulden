import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
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