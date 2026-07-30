import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { Bubble } from '../bubble/bubble';

const MIN_PASSWORD_LENGTH = 6;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, Bubble],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class AuthComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoginMode = true;
  username = '';
  password = '';
  rememberMe = true;
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  /** Wird beim ersten Submit-Versuch true - blendet Feldfehler auch ohne vorheriges Blur ein. */
  submitted = false;

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = false;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.submitted = true;

    const usernameValid = !!this.username.trim();
    const passwordValid = this.password.length >= MIN_PASSWORD_LENGTH;

    if (!usernameValid || !passwordValid) {
      this.errorMessage = 'Bitte prüfe deine Eingaben.';
      return;
    }

    this.isLoading = true;

    if (this.isLoginMode) {
      this.authService.login(this.username, this.password, this.rememberMe).subscribe({
        next: () => {
          this.isLoading = false;
          // Erfolgreich eingeloggt -> Weiterleitung zum Dashboard
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'Login fehlgeschlagen. Überprüfe deine Daten.';
        }
      });
    } else {
      this.authService.register(this.username, this.password).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Account erfolgreich erstellt! Du kannst dich jetzt einloggen.';
          this.isLoginMode = true;
          this.password = ''; // Passwort aus Sicherheitsgründen zurücksetzen
          this.submitted = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'Registrierung fehlgeschlagen.';
        }
      });
    }
  }
}
