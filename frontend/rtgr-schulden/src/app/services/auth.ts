import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TransactionService } from './transaction.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private transactionService = inject(TransactionService);
  private apiUrl = environment.apiUrl;

  /**
   * @param rememberMe true (Standard) = Token in localStorage, übersteht einen
   *   Browser-Neustart. false = Token nur in sessionStorage, verschwindet
   *   sobald der Tab/Browser geschlossen wird ("Angemeldet bleiben"-Checkbox).
   */
  login(username: string, password: string, rememberMe: boolean = true): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { username, password }).pipe(
      tap(res => {
        if (res.token) {
          this.setSession(res.token, res.user, rememberMe);

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
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user');

    // Verhindert, dass beim nächsten Login (anderer User, selber Tab)
    // noch Transaktionsdaten des ausgeloggten Users sichtbar sind.
    this.transactionService.resetState();
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token') ?? sessionStorage.getItem('auth_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): { id: number; username: string } | null {
    const user = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  private setSession(token: string, user: unknown, persist: boolean): void {
    const target = persist ? localStorage : sessionStorage;
    const other = persist ? sessionStorage : localStorage;

    // Alte Session aus dem jeweils anderen Storage entfernen, damit nicht
    // zwei widersprüchliche Tokens gleichzeitig herumliegen.
    other.removeItem('auth_token');
    other.removeItem('user');

    target.setItem('auth_token', token);
    target.setItem('user', JSON.stringify(user));
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/profile`);
  }

  updateProfile(payload: { username?: string; preferredCurrency?: string; reduceMotion?: boolean }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/profile`, payload).pipe(
      tap(response => this.refreshSession(response.token, response.user))
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/profile/password`, { currentPassword, newPassword }).pipe(
      tap(response => this.refreshSession(response.token, this.getCurrentUser()))
    );
  }

  logoutAll(): Observable<any> {
    return this.http.post(`${this.apiUrl}/profile/logout-all`, {});
  }

  deleteAccount(currentPassword: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/profile`, { body: { currentPassword } });
  }

  exportData(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/profile/export`, { responseType: 'blob' });
  }

  private refreshSession(token: string, user: unknown): void {
    if (!token) return;
    const persist = localStorage.getItem('auth_token') !== null;
    this.setSession(token, user, persist);
  }
}
