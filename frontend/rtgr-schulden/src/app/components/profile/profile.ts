import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

interface UserProfile {
  id: number;
  username: string;
}

@Component({
  selector: 'app-profile',
  imports: [Bubble],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentUser: UserProfile | null = null;
  appVersion: string = '1.0.0 (Live)';

  ngOnInit(): void {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        console.error('Fehler beim Parsen der User-Daten', e);
      }
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }
}