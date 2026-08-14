import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  rememberMe = false;
  loading = false;
  error = '';
  private returnUrl = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.rememberMe = this.auth.isRememberMeEnabled();
    this.username = this.auth.getSavedUsername();
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
  }

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

    this.auth.login({ username, password }, this.rememberMe).subscribe({
      next: (user) => {
        this.loading = false;
        this.cdr.detectChanges();
        const target = this.resolveRedirectUrl(user.role);
        if (target.startsWith('/')) {
          this.router.navigateByUrl(target);
        } else {
          this.router.navigate([target]);
        }
      },
      error: (err) => {
        this.loading = false;
        const status = err?.status;

        if (status === 0 || status === 502 || status === 504) {
          this.error =
            'Brak połączenia z API. Na serwerze uruchom aplikację przez publish (dotnet publish), ' +
            'a nie osobno npm start. Adres strony i API musi być ten sam (np. http://serwer:5000).';
        } else if (status === 404) {
          this.error =
            'Nie znaleziono endpointu logowania (/api/auth/login). ' +
            'Sprawdź, czy backend ASP.NET jest uruchomiony i serwuje frontend z folderu publish.';
        } else {
          this.error = err?.error?.message || 'Nieprawidłowy login lub hasło.';
        }

        this.cdr.detectChanges();
      },
    });
  }

  private resolveRedirectUrl(role: string): string {
    if (this.isSafeReturnUrl(this.returnUrl)) {
      return this.returnUrl;
    }
    return role === 'Admin' ? '/admin' : '/panel';
  }

  private isSafeReturnUrl(url: string): boolean {
    return !!url && url.startsWith('/') && !url.startsWith('//');
  }
}
