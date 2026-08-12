import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) { }

  submit(): void {
    const username = this.username.trim();
    const password = this.password;

    if (!username || !password) {
      this.error = 'Podaj login i hasło.';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.auth.login({ username, password }).subscribe({
      next: (user) => {
        this.loading = false;
        this.cdr.detectChanges();
        this.router.navigate([user.role === 'Admin' ? '/admin' : '/panel']);
      },
      error: (err) => {
        this.loading = false;
        const status = err?.status;

        if (status === 0 || status === 502 || status === 504) {
          this.error =
            'Brak połączenia z serwerem API. Uruchom AngularApp1.Server (dotnet run) i odśwież stronę.';
        } else {
          this.error = err?.error?.message || 'Nieprawidłowy login lub hasło.';
        }

        this.cdr.detectChanges();
      },
    });
  }
}
