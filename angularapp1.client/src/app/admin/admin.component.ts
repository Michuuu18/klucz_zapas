import QRCode from 'qrcode';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Car, CarWritePayload } from '../models/car.model';
import { CarService } from '../services/car.service';

type FormMode = 'closed' | 'create' | 'edit';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  private static readonly AUTO_REFRESH_MS = 3000;
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly rows = signal<Car[]>([]);
  readonly loading = signal(false);
  readonly autoRefreshing = signal(false);
  readonly lastSyncedAt = signal<Date | null>(null);
  readonly saving = signal(false);
  readonly returningId = signal<number | null>(null);
  readonly takingId = signal<number | null>(null);
  readonly lostActionId = signal<number | null>(null);
  readonly error = signal('');
  readonly formError = signal('');
  readonly formMode = signal<FormMode>('closed');
  readonly editingId = signal<number | null>(null);
  readonly showQrPanel = signal(false);
  readonly qrCarId = signal<number | null>(null);
  readonly qrKeyName = signal('');
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrGenerating = signal(false);
  readonly qrError = signal('');

  form: CarWritePayload = this.emptyForm();

  readonly qrCanGenerate = computed(
    () => this.qrCarId() !== null && this.qrKeyName().trim().length > 0,
  );
  readonly freeCarsCount = computed(
    () => this.rows().filter((row) => row.status === 'FREE').length,
  );
  readonly inUseCarsCount = computed(
    () => this.rows().filter((row) => row.status === 'IN_USE').length,
  );
  readonly lostCarsCount = computed(
    () => this.rows().filter((row) => row.status === 'LOST').length,
  );
  readonly selectedHistoryCar = computed(
    () => this.rows().find((row) => row.id === this.selectedHistoryCarId()) ?? null,
  );

  constructor(
    private readonly cars: CarService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  get displayName(): string {
    return this.auth.currentUser()?.displayName ?? 'Administrator';
  }

  ngOnInit(): void {
    this.loadRegistry();
    this.refreshTimer = setInterval(() => this.loadRegistry(true), AdminComponent.AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  loadRegistry(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.error.set('');
    } else {
      this.autoRefreshing.set(true);
    }

    this.cars.getRegistry().subscribe({
      next: (data) => {
        this.rows.set(data);
        this.lastSyncedAt.set(new Date());
        this.loading.set(false);
        this.autoRefreshing.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.autoRefreshing.set(false);
        if (!silent) {
          this.error.set(
            err?.error?.message ?? err?.message ?? 'Nie udało się pobrać rejestru.',
          );
        }
      },
    });
  }

  openCreate(): void {
    if (this.formMode() === 'create') {
      this.closeForm();
      return;
    }
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.formError.set('');
    this.formMode.set('create');
    this.showQrPanel.set(false);
  }

  openQrPanel(): void {
    const opening = !this.showQrPanel();
    this.showQrPanel.set(opening);
    if (opening) {
      this.formMode.set('closed');
      this.qrCarId.set(null);
      this.qrKeyName.set('');
      this.qrDataUrl.set(null);
      this.qrError.set('');
    }
  }

  onQrCarChange(carId: number | string | null): void {
    const id =
      carId === null || carId === '' || carId === 'null' ? null : Number(carId);
    this.qrCarId.set(Number.isNaN(id as number) ? null : id);
    const car = this.rows().find((r) => r.id === this.qrCarId());
    this.qrKeyName.set(car?.qrCode ?? '');
    this.qrDataUrl.set(null);
    this.qrError.set('');
  }

  closeQrPanel(): void {
    this.showQrPanel.set(false);
  }

  async generateQr(): Promise<void> {
    if (!this.qrCanGenerate() || this.qrGenerating()) return;

    const car = this.rows().find((r) => r.id === this.qrCarId());
    if (!car) {
      this.qrError.set('Wybierz auto z listy.');
      return;
    }

    const newCode = this.qrKeyName().trim();
    if (!newCode) {
      this.qrError.set('Podaj kod QR.');
      return;
    }

    this.qrGenerating.set(true);
    this.qrError.set('');

    const renderQr = async () => {
      const scanUrl = `${window.location.origin}/key/${encodeURIComponent(newCode)}?mode=take`;
      const dataUrl = await QRCode.toDataURL(scanUrl, { width: 280, margin: 1 });
      this.qrDataUrl.set(dataUrl);
    };

    // Jeśli kod się nie zmienił — tylko generuj obraz, bez zapisu do API.
    if (car.qrCode === newCode) {
      try {
        await renderQr();
      } catch {
        this.qrError.set('Nie udało się wygenerować obrazu QR.');
      } finally {
        this.qrGenerating.set(false);
      }
      return;
    }

    const payload: CarWritePayload = {
      brand: car.brand,
      model: car.model || '—',
      registration: car.registration,
      keyNumber: car.keyNumber,
      qrCode: newCode,
    };

    this.cars.updateCar(car.id, payload).subscribe({
      next: async () => {
        try {
          await renderQr();
          this.loadRegistry();
        } catch {
          this.qrError.set('Kod zapisany, ale nie udało się wygenerować obrazu QR.');
        } finally {
          this.qrGenerating.set(false);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.qrGenerating.set(false);
        this.qrError.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się zapisać kodu QR.',
        );
      },
    });
  }

  downloadQr(): void {
    const dataUrl = this.qrDataUrl();
    if (!dataUrl) return;

    const car = this.rows().find((r) => r.id === this.qrCarId());
    const filename = `qr-${car?.registration ?? 'auto'}.png`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  openEdit(row: Car): void {
    this.form = {
      brand: row.brand ?? '',
      model: row.model ?? '',
      registration: row.registration ?? '',
      keyNumber: row.keyNumber ?? '',
      qrCode: row.qrCode ?? '',
    };
    this.editingId.set(row.id);
    this.formError.set('');
    this.formMode.set('edit');
    this.showQrPanel.set(false);
  }

  closeForm(): void {
    this.formMode.set('closed');
    this.editingId.set(null);
    this.formError.set('');
    this.form = this.emptyForm();
  }

  saveForm(): void {
    if (this.saving()) return;

    const payload: CarWritePayload = {
      brand: this.form.brand.trim(),
      model: this.form.model.trim(),
      registration: this.form.registration.trim(),
      keyNumber: this.form.keyNumber.trim(),
      qrCode: this.form.qrCode.trim(),
    };

    if (
      !payload.brand ||
      !payload.model ||
      !payload.registration ||
      !payload.keyNumber ||
      !payload.qrCode
    ) {
      this.formError.set('Uzupełnij wszystkie pola formularza.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const request$ =
      this.formMode() === 'edit' && this.editingId() != null
        ? this.cars.updateCar(this.editingId()!, payload)
        : this.cars.createCar(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się zapisać auta.',
        );
      },
    });
  }

  takeCar(row: Car): void {
    if (row.status !== 'FREE' || this.takingId() != null) return;

    const qrCode = row.qrCode?.trim();
    if (!qrCode) {
      this.error.set('To auto nie ma przypisanego kodu QR — edytuj auto i uzupełnij kod.');
      return;
    }

    this.takingId.set(row.id);
    this.error.set('');

    this.cars.takeCar(qrCode).subscribe({
      next: () => {
        this.takingId.set(null);
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.takingId.set(null);
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się zabrać auta.',
        );
      },
    });
  }

  returnCar(row: Car): void {
    if (row.status !== 'IN_USE' || this.returningId() != null) return;

    const loginId = this.auth.currentUser()?.username?.trim();
    if (!loginId) {
      this.error.set('Brak zalogowanego użytkownika.');
      return;
    }

    this.returningId.set(row.id);
    this.error.set('');

    this.cars.returnCarById(row.id, loginId).subscribe({
      next: () => {
        this.returningId.set(null);
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.returningId.set(null);
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się zwrócić auta.',
        );
      },
    });
  }

  deleteCar(id: number, label: string): void {
    if (!confirm(`Czy na pewno usunąć auto: ${label}?`)) return;

    this.cars.deleteCar(id).subscribe({
      next: () => {
        this.error.set('');
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się usunąć auta.',
        );
      },
    });
  }

  deleteFromForm(): void {
    const id = this.editingId();
    if (id == null) return;
    const row = this.rows().find((r) => r.id === id);
    if (!row) return;

    if (row.status === 'IN_USE') {
      this.formError.set('Nie można usunąć auta, które jest aktualnie w użyciu.');
      return;
    }

    const label = `${row.brand} ${row.model} (${row.registration || 'brak tablic'})`;
    this.closeForm();
    this.deleteCar(id, label);
  }

  markLost(row: Car): void {
    if (row.status === 'IN_USE' || this.lostActionId() != null) return;

    const loginId = this.auth.currentUser()?.username?.trim();
    if (!loginId) {
      this.error.set('Brak zalogowanego użytkownika.');
      return;
    }

    const label = `${row.brand} ${row.model} (${row.registration || 'brak tablic'})`;
    if (
      !confirm(
        `Oznaczyć kluczyk jako ZAGUBIONY?\n${label}\n\nAuto zostanie oznaczone jako niedostępne.`,
      )
    ) {
      return;
    }

    this.lostActionId.set(row.id);
    this.error.set('');
    this.cars.markLost(row.id, loginId).subscribe({
      next: () => {
        this.lostActionId.set(null);
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.lostActionId.set(null);
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako zagubiony.',
        );
      },
    });
  }

  markFound(row: Car): void {
    if (row.status !== 'LOST' || this.lostActionId() != null) return;

    const label = `${row.brand} ${row.model} (${row.registration || 'brak tablic'})`;
    if (
      !confirm(
        `Oznaczyć kluczyk jako ODNALEZIONY?\n${label}\n\nAuto wróci do stanu "Wolne".`,
      )
    ) {
      return;
    }

    this.lostActionId.set(row.id);
    this.error.set('');
    this.cars.markFound(row.id).subscribe({
      next: () => {
        this.lostActionId.set(null);
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.lostActionId.set(null);
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako odnaleziony.',
        );
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'IN_USE') return 'W użyciu';
    if (status === 'LOST') return 'Zagubiony';
    return 'Wolne';
  }

  formatDuration(totalMinutes: number | null): string {
    if (totalMinutes == null || totalMinutes < 0) {
      return '—';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    if (minutes === 0) {
      return `${hours} godz.`;
    }

    return `${hours} godz. ${minutes} min`;
  }

  formTitle(): string {
    return this.formMode() === 'edit' ? 'Edytuj auto' : 'Dodaj nowe auto';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private emptyForm(): CarWritePayload {
    return {
      brand: '',
      model: '',
      registration: '',
      keyNumber: '',
      qrCode: '',
    };
  }
}
