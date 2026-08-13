import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AppUser, LoginRequest } from '../models/user.model';

const STORAGE_KEY = 'klucz-zapas.currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';

  /** Aktualnie zalogowany użytkownik + JWT (null = brak sesji). */
  readonly currentUser = signal<AppUser | null>(this.readFromStorage());

  constructor(private readonly http: HttpClient) {}

  login(credentials: LoginRequest): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.apiUrl}/login`, credentials).pipe(
      tap((user) => {
        this.currentUser.set(user);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      }),
    );
  }

  logout(): void {
    this.currentUser.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  /** Token JWT do nagłówka Authorization: Bearer ... */
  getToken(): string | null {
    return this.currentUser()?.token ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: 'Admin' | 'Pracownik'): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }
    // Admin ma dostęp również do widoków pracownika.
    return user.role === role || user.role === 'Admin';
  }

  private readFromStorage(): AppUser | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const user = JSON.parse(raw) as AppUser;
      // Stara sesja bez tokena (sprzed JWT) — wymuś ponowne logowanie.
      if (!user?.token) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }
}
