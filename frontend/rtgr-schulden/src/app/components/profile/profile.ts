import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bubble } from '../bubble/bubble';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { UserPreferencesService } from '../../services/user-preferences.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, Bubble],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private prefs = inject(UserPreferencesService);

  username = '';
  // Aus dem gecachten Service vorbelegt statt hart 'EUR'/false - vermeidet
  // ein kurzes Aufblitzen des Standardzustands, bis getProfile() zurück ist.
  preferredCurrency = this.prefs.currency;
  reduceMotion = false;
  currentPassword = '';
  newPassword = '';
  deletePassword = '';
  openSection: 'profile' | 'security' | 'data' | null = null;
  message = '';
  error = '';
  saving = false;

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.username = user?.username ?? '';
    this.auth.getProfile().subscribe({
      next: profile => {
        this.username = profile.username;
        this.preferredCurrency = profile.preferredCurrency;
        this.reduceMotion = Boolean(profile.reduceMotion);
        this.prefs.setCurrency(profile.preferredCurrency);
        this.prefs.setReduceMotion(this.reduceMotion);
      },
      error: () => this.error = 'Profil konnte nicht geladen werden.'
    });
  }

  toggle(section: 'profile' | 'security' | 'data'): void {
    this.openSection = this.openSection === section ? null : section;
    this.clearNotice();
  }

  saveProfile(): void {
    this.run(this.auth.updateProfile({ username: this.username, preferredCurrency: this.preferredCurrency, reduceMotion: this.reduceMotion }),
      () => {
        this.prefs.setCurrency(this.preferredCurrency);
        this.prefs.setReduceMotion(this.reduceMotion);
        this.message = 'Dein Profil wurde gespeichert.';
      });
  }

  changePassword(): void {
    if (this.newPassword.length < 6) { this.error = 'Das neue Passwort braucht mindestens 6 Zeichen.'; return; }
    this.run(this.auth.changePassword(this.currentPassword, this.newPassword), () => {
      this.currentPassword = ''; this.newPassword = '';
      this.message = 'Passwort geändert. Andere Sitzungen wurden beendet.';
    });
  }

  logoutAll(): void {
    this.run(this.auth.logoutAll(), () => {
      this.auth.logout();
      this.router.navigate(['/auth']);
    });
  }

  exportData(): void {
    this.clearNotice();
    this.auth.exportData().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'schuldenapp-export.csv';
        // Muss im DOM hängen, damit .click() zuverlässig einen Download
        // auslöst - ohne append funktioniert das in Chrome/Firefox meist,
        // auf Safari/iOS (wichtig hier: installierbare iOS-PWA) aber nicht
        // zuverlässig.
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.message = 'Dein CSV-Export wurde heruntergeladen.';
      }, error: () => this.error = 'Export konnte nicht erstellt werden.'
    });
  }

  deleteAccount(): void {
    if (!this.deletePassword) { this.error = 'Bitte bestätige mit deinem Passwort.'; return; }
    if (!confirm('Konto und zugehörige Daten wirklich endgültig löschen?')) return;
    this.run(this.auth.deleteAccount(this.deletePassword), () => {
      this.auth.logout();
      this.router.navigate(['/auth']);
    });
  }

  logout(): void { this.auth.logout(); this.router.navigate(['/auth']); }

  private run(request: any, onSuccess: () => void): void {
    this.saving = true; this.clearNotice();
    request.subscribe({ next: () => { this.saving = false; onSuccess(); }, error: (err: any) => {
      this.saving = false; this.error = err.error?.error || 'Etwas ist schiefgelaufen.';
    }});
  }

  private clearNotice(): void { this.message = ''; this.error = ''; }
}
