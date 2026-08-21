import { Component } from '@angular/core';
import { ThemeService } from './theme';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Od razu przy starcie aplikacji — ten sam motyw na loginie i po zalogowaniu.
  constructor(private readonly theme: ThemeService) {}
}
