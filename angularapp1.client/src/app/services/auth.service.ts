import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AppUser, LoginRequest } from '../models/user.model';

const SESSION_USER_KEY = 'klucz-zapas.currentUser';
const PERSIST_USER_KEY = 'klucz-zapas.currentUser.persist';
const REMEMBER_KEY = 'klucz-zapas.rememberMe';
const SAVED_USERNAME_KEY = 'klucz-zapas.savedUsername';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';

  // Aktualnie zalogowany użytkownik (null = brak sesji).
  readonly currentUser = signal<AppUser | null>(this.readFromStorage());

  constructor(private readonly http: HttpClient) {}

  login(credentials: LoginRequest, rememberMe = false): Observable<AppUser> {
    return this.http.post<AppUser>(`${this.apiUrl}/login`, credentials).pipe(
      tap((user) => {
        this.persistUser(user, rememberMe);
        this.persistRememberPreference(rememberMe, credentials.username.trim());
      }),
    );
  }

  logout(): void {
    this.currentUser.set(null);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(PERSIST_USER_KEY);
  }

  isRememberMeEnabled(): boolean {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  }

  getSavedUsername(): string {
    if (!this.isRememberMeEnabled()) {
      return '';
    }
    return localStorage.getItem(SAVED_USERNAME_KEY) ?? '';
  }

  // Token JWT do nagłówka Authorization.
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
    return user.role === role || user.role === 'Admin';
  }

  private persistUser(user: AppUser, rememberMe: boolean): void {
    this.currentUser.set(user);
    const serialized = JSON.stringify(user);

    sessionStorage.setItem(SESSION_USER_KEY, serialized);
    if (rememberMe) {
      localStorage.setItem(PERSIST_USER_KEY, serialized);
    } else {
      localStorage.removeItem(PERSIST_USER_KEY);
    }
  }

  private persistRememberPreference(rememberMe: boolean, username: string): void {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(SAVED_USERNAME_KEY, username);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SAVED_USERNAME_KEY);
    }
  }

  private readFromStorage(): AppUser | null {
    const raw =
      localStorage.getItem(PERSIST_USER_KEY) ?? sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      const user = JSON.parse(raw) as AppUser;
      if (!user?.token) {
        this.clearStoredUser();
        return null;
      }
      return user;
    } catch {
      this.clearStoredUser();
      return null;
    }
  }

  private clearStoredUser(): void {
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(PERSIST_USER_KEY);
  }
}
