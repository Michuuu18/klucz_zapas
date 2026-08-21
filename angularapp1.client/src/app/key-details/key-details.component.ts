import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Car } from '../models/car.model';
import { AuthService } from '../services/auth.service';
import { CarService } from '../services/car.service';

@Component({
  selector: 'app-key-details',
  standalone: false,
  templateUrl: './key-details.component.html',
  styleUrl: './key-details.component.scss',
})
export class KeyDetailsComponent implements OnInit {
  code = '';
  mode: 'take' | 'return' | 'auto' = 'auto';
  record: Car | null = null;
  loading = true;
  error = '';
  confirming = false;
  needsForceTake = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cars: CarService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get pageTitle(): string {
    if (this.needsForceTake) return 'Potwierdzenie zabrania';
    if (this.mode === 'return') return 'Potwierdzenie oddania klucza';
    if (this.mode === 'take') return 'Potwierdzenie zebrania klucza';
    return 'Potwierdzenie akcji po skanowaniu';
  }

  ngOnInit(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.loadCar();
  }

  loadCar(): void {
    this.loading = true;
    this.error = '';
    this.record = null;
    this.needsForceTake = false;
    this.cdr.detectChanges();

    this.cars.getByQrCode(this.code).subscribe({
      next: (car) => {
        this.record = car;
        this.applyModeForCar(car);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.record = null;
        this.loading = false;
        const status = err?.status;
        if (status === 0 || status === 502 || status === 504) {
          this.error =
            'Brak połączenia z serwerem API. Uruchom AngularApp1.Server (dotnet run) i odśwież stronę.';
        } else if (status === 401) {
          this.error = 'Sesja wygasła. Wyloguj się i zaloguj ponownie.';
        } else if (status === 403) {
          this.error = 'Brak uprawnień do pobrania danych pojazdu.';
        } else if (status === 404) {
          this.error = 'Nie znaleziono kluczyka';
        } else {
          this.error =
            err?.error?.message || 'Nie udało się pobrać danych pojazdu.';
        }
        this.cdr.detectChanges();
      },
    });
  }

  private applyModeForCar(car: Car): void {
    const queryMode = this.route.snapshot.queryParamMap.get('mode');
    const me = this.auth.currentUser()?.username?.trim().toLowerCase() ?? '';
    const holder = car.heldBy?.trim().toLowerCase() ?? '';

    if (queryMode === 'take' && car.status === 'IN_USE') {
      if (holder && me && holder === me) {
        this.needsForceTake = false;
        this.mode = 'return';
        return;
      }

      this.needsForceTake = true;
      this.mode = 'take';
      return;
    }

    this.needsForceTake = false;
    this.mode = this.getModeForStatus(car.status);
  }

  private getModeForStatus(status: string): 'take' | 'return' {
    if (status === 'IN_USE' || status === 'LOST') return 'return';
    return 'take';
  }

  goBack(): void {
    this.router.navigate(['/scanner'], { queryParams: { mode: this.mode } });
  }

  keyKindLabel(car: Car): string {
    const key = car.keyNumber?.trim().toUpperCase() ?? '';
    if (key.includes('-Z-') || key.startsWith('K-Z')) return 'Klucz zapasowy';
    return 'Klucz oryginalny';
  }

  confirm(): void {
    if (!this.record || this.confirming) {
      return;
    }

    this.confirming = true;
    this.error = '';
    this.cdr.detectChanges();

    const request =
      this.mode === 'return'
        ? this.cars.returnCar(this.record.qrCode)
        : this.cars.takeCar(this.record.qrCode, this.needsForceTake);

    request.subscribe({
      next: () => {
        this.confirming = false;
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.confirming = false;
        this.error =
          err?.error?.message ||
          (this.mode === 'return'
            ? 'Nie udało się oddać auta.'
            : 'Nie udało się pobrać auta.');
        this.cdr.detectChanges();
      },
    });
  }
}
