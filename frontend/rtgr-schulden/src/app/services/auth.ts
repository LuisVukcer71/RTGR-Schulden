import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { TransactionService } from './transaction.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private transactionService = inject(TransactionService);
  private apiUrl = 'http://localhost:3000/api';

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { username, password }).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('auth_token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));

          // Gecachten State der vorherigen Session (anderer User im
          // selben Tab) verwerfen und sofort mit dem neuen Token die
          // Daten des jetzt eingeloggten Users frisch laden.
          this.transactionService.resetState();
          this.transactionService.loadTransactions();
        }
      })
    );
  }

  register(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, { username, password });
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    // Verhindert, dass beim nächsten Login (anderer User, selber Tab)
    // noch Transaktionsdaten des ausgeloggten Users sichtbar sind.
    this.transactionService.resetState();
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): { id: number; username: string } | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }
}