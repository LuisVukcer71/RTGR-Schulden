import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'RTGR Schulden';

  private authService = inject(AuthService);

  constructor() {
    // Läuft genau einmal pro App-Start (nicht pro Routenwechsel): bei
    // bestehender Session Währung + "Bewegung reduzieren" sofort laden,
    // statt erst wenn der User zufällig den Profil-Tab öffnet.
    if (this.authService.isLoggedIn()) {
      this.authService.applyPreferences();
    }
  }
}