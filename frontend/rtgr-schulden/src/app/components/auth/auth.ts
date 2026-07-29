import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { Bubble } from '../bubble/bubble'; 

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
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Bitte fülle alle Felder aus.';
      return;
    }

    this.isLoading = true;

    if (this.isLoginMode) {
      this.authService.login(this.username, this.password).subscribe({
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
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'Registrierung fehlgeschlagen.';
        }
      });
    }
  }
}