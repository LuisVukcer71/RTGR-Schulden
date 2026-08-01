import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TransactionService } from './transaction.service';
import { UserPreferencesService } from './user-preferences.service';
import { FriendService } from './friend.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private transactionService = inject(TransactionService);
  private friendService = inject(FriendService);
  private userPreferences = inject(UserPreferencesService);
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
          this.friendService.resetState();

          // Währung/Bewegung-reduzieren sofort laden - nicht erst, wenn der
          // User zufällig die Profil-Seite öffnet (siehe applyPreferences()).
          this.applyPreferences();
        }
      })
    );
  }

  /**
   * Lädt einmal das Profil und wendet Währung + "Bewegung reduzieren" app-weit
   * an. Wird beim Login aufgerufen UND beim App-Start, falls schon eine
   * gültige Session existiert (siehe App-Root-Komponente) - vorher griff
   * keine der beiden Einstellungen, bevor man aktiv den Profil-Tab öffnete.
   */
  applyPreferences(): void {
    this.getProfile().subscribe({
      next: profile => {
        this.userPreferences.setCurrency(profile.preferredCurrency);
        this.userPreferences.setReduceMotion(Boolean(profile.reduceMotion));
      },
      // Keine Aktion nötig: Service bleibt auf dem gecachten/Default-Wert,
      // ProfileComponent versucht es beim Öffnen ohnehin erneut.
      error: () => {}
    });
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
    // noch Transaktions-/Freundesdaten des ausgeloggten Users sichtbar sind.
    this.transactionService.resetState();
    this.friendService.resetState();
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token') ?? sessionStorage.getItem('auth_token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): { id: number; username: string } | null {
    const user = localStorage.getItem('user') ?? sessionStorage.getItem('user');
    if (!user) return null;
    try {
      return JSON.parse(user);
    } catch {
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      return null;
    }
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
