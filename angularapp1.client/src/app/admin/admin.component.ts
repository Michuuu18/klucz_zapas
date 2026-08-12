import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) { }

  get displayName(): string {
    return this.auth.currentUser()?.displayName ?? 'Administrator';
  }

  goToEmployeePanel(): void {
    this.router.navigate(['/panel']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
