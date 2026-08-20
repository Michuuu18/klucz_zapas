import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../theme';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly themeService: ThemeService,
  ) {}

  get displayName(): string {
    return this.auth.currentUser()?.displayName ?? 'Pracownik';
  }

  get isAdmin(): boolean {
    return this.auth.currentUser()?.role === 'Admin';
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkTheme;
  }

  toggleDarkMode(): void {
    this.themeService.toggleTheme();
  }

  goToAdminPanel(): void {
    this.router.navigate(['/admin']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
