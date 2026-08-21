import { Injectable } from '@angular/core';

const THEME_KEY = 'klucz-zapas.theme';
const LEGACY_THEME_KEY = 'theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  public isDarkTheme = false;

  constructor() {
    this.initTheme();
  }

  // Domyślnie light; zapisany wybór użytkownika ma pierwszeństwo.
  private initTheme(): void {
    const saved =
      localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);

    this.isDarkTheme = saved === 'dark';
    this.applyTheme();
  }

  public toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem(THEME_KEY, this.isDarkTheme ? 'dark' : 'light');
    localStorage.removeItem(LEGACY_THEME_KEY);
    this.applyTheme();
  }

  private applyTheme(): void {
    const body = document.body;
    if (!body) {
      return;
    }

    body.classList.toggle('dark-theme', this.isDarkTheme);
    document.documentElement.style.colorScheme = this.isDarkTheme
      ? 'dark'
      : 'light';
  }
}
