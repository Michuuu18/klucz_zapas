import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Car } from '../models/car.model';
import { CarService } from '../services/car.service';

@Component({
  selector: 'app-key-details',
  standalone: false,
  templateUrl: './key-details.component.html',
  styleUrl: './key-details.component.scss',
})
export class KeyDetailsComponent implements OnInit {
  code = '';
  mode = 'take';
  record: Car | null = null;
  loading = true;
  error = '';
  confirming = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cars: CarService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get pageTitle(): string {
    return this.mode === 'return'
      ? 'Potwierdzenie oddania auta'
      : 'Potwierdzenie pobrania auta';
  }

  ngOnInit(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.mode = this.route.snapshot.queryParamMap.get('mode') ?? 'take';
    this.loadCar();
  }

  loadCar(): void {
    this.loading = true;
    this.error = '';
    this.record = null;
    this.cdr.detectChanges();

    this.cars.getByQrCode(this.code).subscribe({
      next: (car) => {
        this.record = car;
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

  goBack(): void {
    this.router.navigate(['/scanner'], { queryParams: { mode: this.mode } });
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
        : this.cars.takeCar(this.record.qrCode);

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
