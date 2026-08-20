import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Przechowuje informację, czy obecny motyw to ciemny
  public isDarkTheme = false;

  constructor() {
    // Odpala się od razu po załadowaniu aplikacji
    this.initTheme();
  }

  private initTheme() {
    // 1. Sprawdzamy, czy użytkownik ustawił już coś wcześniej (zapis w przeglądarce)
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
      this.isDarkTheme = savedTheme === 'dark';
    } else {
      // 2. Jeśli jest tu pierwszy raz, CZYTAMY USTAWIENIA Z TELEFONU/SYSTEMU
      this.isDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Zastosuj style
    this.applyTheme();
  }

  // Zmiana motywu po kliknięciu w przycisk
  public toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    this.applyTheme();
  }

  // Fizyczne dodanie/usunięcie klasy 'dark-theme' z <body>
  private applyTheme() {
    if (this.isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}
