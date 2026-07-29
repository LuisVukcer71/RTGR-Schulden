import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Bubble } from '../bubble/bubble';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

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
  private http = inject(HttpClient);
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}