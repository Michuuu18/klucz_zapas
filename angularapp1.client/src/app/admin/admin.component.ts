import QRCode from 'qrcode';
import { Component, OnInit, OnDestroy, computed, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Car, CarWritePayload, HistoryRecord } from '../models/car.model';
import { CarService } from '../services/car.service';
import { ThemeService } from '../theme';
type FormMode = 'closed' | 'create' | 'edit';
type KeyKind = 'O' | 'Z';
type StatusConfirmKind = 'lost' | 'found';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})


export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('settingsDropdown') settingsDropdownRef!: ElementRef;
  @ViewChild('qrDropdownRef') qrDropdownRef!: ElementRef;
  @ViewChild('historyDropdownRef') historyDropdownRef!: ElementRef;
  @ViewChild('editDropdownRef') editDropdownRef!: ElementRef;

  // Nasłuchiwanie kliknięć na całym dokumencie
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (this.settingsMenuOpen() && this.settingsDropdownRef && !this.settingsDropdownRef.nativeElement.contains(target)) {
      this.settingsMenuOpen.set(false);
    }
    if (this.qrDropdownOpen() && this.qrDropdownRef && !this.qrDropdownRef.nativeElement.contains(target)) {
      this.qrDropdownOpen.set(false);
    }
    if (this.historyDropdownOpen() && this.historyDropdownRef && !this.historyDropdownRef.nativeElement.contains(target)) {
      this.historyDropdownOpen.set(false);
    }
    if (this.editDropdownOpen() && this.editDropdownRef && !this.editDropdownRef.nativeElement.contains(target)) {
      this.editDropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmRow() && this.lostActionId() == null) {
      this.closeStatusConfirm();
    }
  }
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
  readonly settingsMenuOpen = signal(false);
  readonly showHistoryPanel = signal(false);
  readonly selectedHistoryCarId = signal<number | null>(null);
  readonly historyRows = signal<HistoryRecord[]>([]);
  readonly historyLoading = signal(false);
  readonly qrDropdownOpen = signal(false);
  readonly historyDropdownOpen = signal(false);
  readonly editDropdownOpen = signal(false);
  readonly keyKind = signal<KeyKind>('O');
  readonly noteCarId = signal<number | null>(null);
  readonly noteSaving = signal(false);
  readonly noteError = signal('');
  readonly historyNoteText = signal<string | null>(null);
  readonly confirmRow = signal<Car | null>(null);
  readonly confirmKind = signal<StatusConfirmKind | null>(null);
  readonly toastMessage = signal('');
  noteDraft = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

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

  toggleSettingsMenu(): void {
    this.settingsMenuOpen.set(!this.settingsMenuOpen());
  }

  toggleDarkMode(): void {
    this.themeService.toggleTheme();
  }

  constructor(
    private readonly cars: CarService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private themeService: ThemeService
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
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  loadRegistry(silent = false): void {
    if (silent && (this.noteCarId() != null || this.confirmRow() != null)) {
      return;
    }
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
    this.keyKind.set('O');
    this.editingId.set(null);
    this.formError.set('');
    this.formMode.set('create');
    this.showQrPanel.set(false);
    this.showHistoryPanel.set(false);
    this.closeNotePanel();
    this.closeStatusConfirm();
  }

  onKeyKindChange(kind: KeyKind): void {
    this.keyKind.set(kind);
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
      this.showHistoryPanel.set(false);
      this.closeNotePanel();
      this.closeStatusConfirm();
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

  openHistoryPanel(): void {
    const opening = !this.showHistoryPanel();
    this.showHistoryPanel.set(opening);
    if (opening) {
      this.formMode.set('closed');
      this.showQrPanel.set(false);
      this.closeNotePanel();
      this.closeStatusConfirm();
      this.selectedHistoryCarId.set(null);
      this.historyRows.set([]);
    }
  }

  closeHistoryPanel(): void {
    this.showHistoryPanel.set(false);
    this.historyNoteText.set(null);
  }

  onHistoryCarChange(carId: number | string | null): void {
    const id = carId === null || carId === '' || carId === 'null' ? null : Number(carId);
    const parsedId = Number.isNaN(id as number) ? null : id;
    this.selectedHistoryCarId.set(parsedId);

    if (parsedId) {
      this.loadHistoryForCar(parsedId);
    } else {
      this.historyRows.set([]);
    }
  }

  loadHistoryForCar(carId: number): void {
    this.historyLoading.set(true);
    this.cars.getHistory(carId).subscribe({
      next: (data) => {
        this.historyRows.set(data);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyRows.set([]);
        this.historyLoading.set(false);
      },
    });
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
    // Tryb (oddanie/zabranie) ustalamy dynamicznie po zeskanowaniu na podstawie statusu auta.
    const scanUrl = `${window.location.origin}/key/${encodeURIComponent(newCode)}`;
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

  openEditMode(): void {
    if (this.formMode() === 'edit') {
      this.closeForm();
      return;
    }
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.formError.set('');
    this.formMode.set('edit');
    this.showQrPanel.set(false);
    this.showHistoryPanel.set(false);
    this.closeNotePanel();
    this.closeStatusConfirm();
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
    this.showHistoryPanel.set(false);
    this.closeNotePanel();
    this.closeStatusConfirm();
  }

  onEditCarSelect(carId: number | string | null): void {
    const id = carId === null || carId === '' || carId === 'null' ? null : Number(carId);
    const parsedId = Number.isNaN(id as number) ? null : id;
    this.editingId.set(parsedId);

    if (parsedId) {
      const row = this.rows().find((r) => r.id === parsedId);
      if (row) {
        this.form = {
          brand: row.brand ?? '',
          model: row.model ?? '',
          registration: row.registration ?? '',
          keyNumber: row.keyNumber ?? '',
          qrCode: row.qrCode ?? '',
        };
      }
    } else {
      this.form = this.emptyForm();
    }
  }

  closeForm(): void {
    this.formMode.set('closed');
    this.editingId.set(null);
    this.formError.set('');
    this.keyKind.set('O');
    this.editDropdownOpen.set(false);
    this.form = this.emptyForm();
  }

  saveForm(): void {
    if (this.saving()) return;

    const generated = this.formMode() === 'create' ? this.nextKeySlot(this.keyKind()) : null;
    const selected = this.formMode() === 'edit'
      ? this.rows().find((row) => row.id === this.editingId())
      : undefined;

    const payload: CarWritePayload = {
      brand: this.form.brand.trim() || selected?.brand?.trim() || '—',
      model: this.form.model.trim() || selected?.model?.trim() || '—',
      registration: this.form.registration.trim(),
      keyNumber: generated?.keyNumber || this.form.keyNumber.trim() || selected?.keyNumber?.trim() || '',
      qrCode: generated?.qrCode || this.form.qrCode.trim() || selected?.qrCode?.trim() || '',
    };

    if (this.formMode() === 'edit') {
      if (this.editingId() == null) {
        this.formError.set('Wybierz auto, którego tablice chcesz zmienić.');
        return;
      }

      if (!payload.registration) {
        this.formError.set('Podaj nowe tablice rejestracyjne.');
        return;
      }
    } else if (!payload.brand || !payload.registration) {
      this.formError.set('Uzupełnij markę i tablice rejestracyjne.');
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
        this.loadRegistry(true);
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
        if (this.noteCarId() === row.id) {
          this.closeNotePanel();
        }
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
    if (this.lostActionId() != null) return;

    const loginId = this.auth.currentUser()?.username?.trim();
    if (!loginId) {
      this.error.set('Brak zalogowanego użytkownika.');
      return;
    }

    this.openStatusConfirm(row, 'lost');
  }

  markFound(row: Car): void {
    if (row.status !== 'LOST' || this.lostActionId() != null) return;
    this.openStatusConfirm(row, 'found');
  }

  openStatusConfirm(row: Car, kind: StatusConfirmKind): void {
    this.formMode.set('closed');
    this.showQrPanel.set(false);
    this.showHistoryPanel.set(false);
    this.closeNotePanel();
    this.confirmKind.set(kind);
    this.confirmRow.set(row);
  }

  closeStatusConfirm(): void {
    if (this.lostActionId() != null) return;
    this.confirmRow.set(null);
    this.confirmKind.set(null);
  }

  confirmStatusChange(): void {
    const row = this.confirmRow();
    const kind = this.confirmKind();
    if (!row || !kind || this.lostActionId() != null) return;

    this.lostActionId.set(row.id);
    this.error.set('');

    if (kind === 'lost') {
      const loginId = this.auth.currentUser()?.username?.trim();
      if (!loginId) {
        this.lostActionId.set(null);
        this.error.set('Brak zalogowanego użytkownika.');
        return;
      }

      this.cars.markLost(row.id, loginId).subscribe({
        next: () => {
          this.lostActionId.set(null);
          this.closeStatusConfirm();
          this.showToast('Kluczyk został oznaczony jako zagubiony.');
          this.loadRegistry();
        },
        error: (err: HttpErrorResponse) => {
          this.lostActionId.set(null);
          this.error.set(
            err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako zagubiony.'
          );
        },
      });
      return;
    }

    this.cars.markFound(row.id).subscribe({
      next: () => {
        this.lostActionId.set(null);
        this.closeStatusConfirm();
        this.showToast('Kluczyk został oznaczony jako znaleziony.');
        this.loadRegistry();
      },
      error: (err: HttpErrorResponse) => {
        this.lostActionId.set(null);
        this.error.set(
          err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako znaleziony.',
        );
      },
    });
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set('');
      }
    }, 3500);
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
    return this.formMode() === 'edit' ? 'Edytuj tablice' : 'Dodaj nowy klucz';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private nextKeySlot(kind: KeyKind): { keyNumber: string; qrCode: string } {
    const keyPattern = new RegExp(`^K-${kind}-(\\d+)$`, 'i');
    const qrPattern = new RegExp(`^QR-${kind}-(\\d+)$`, 'i');
    const used = new Set<number>();
    const takenKeys = new Set(
      this.rows().map((row) => row.keyNumber.trim().toUpperCase()),
    );
    const takenQrs = new Set(
      this.rows().map((row) => row.qrCode.trim().toUpperCase()),
    );

    for (const row of this.rows()) {
      const keyMatch = row.keyNumber?.trim().match(keyPattern);
      if (keyMatch) used.add(Number(keyMatch[1]));
      const qrMatch = row.qrCode?.trim().match(qrPattern);
      if (qrMatch) used.add(Number(qrMatch[1]));
    }

    let slot = 1;
    while (true) {
      const padded = String(slot).padStart(2, '0');
      const keyNumber = `K-${kind}-${padded}`;
      const qrCode = `QR-${kind}-${padded}`;
      if (
        !used.has(slot) &&
        !takenKeys.has(keyNumber.toUpperCase()) &&
        !takenQrs.has(qrCode.toUpperCase())
      ) {
        return { keyNumber, qrCode };
      }
      slot += 1;
    }
  }

  openNote(row: Car): void {
    this.formMode.set('closed');
    this.showQrPanel.set(false);
    this.showHistoryPanel.set(false);
    this.closeStatusConfirm();
    this.historyNoteText.set(null);
    this.noteCarId.set(row.id);
    this.noteDraft = row.note ?? '';
    this.noteError.set('');
    this.noteSaving.set(false);
  }

  openHistoryNote(record: HistoryRecord): void {
    this.formMode.set('closed');
    this.showQrPanel.set(false);
    this.noteCarId.set(null);
    this.noteDraft = '';
    this.historyNoteText.set(record.note ?? '');
  }

  closeNotePanel(): void {
    this.noteCarId.set(null);
    this.historyNoteText.set(null);
    this.noteDraft = '';
    this.noteError.set('');
    this.noteSaving.set(false);
  }

  saveNote(): void {
    const id = this.noteCarId();
    if (id == null || this.noteSaving()) return;

    this.noteSaving.set(true);
    this.noteError.set('');

    this.cars.updateNote(id, this.noteDraft.trim()).subscribe({
      next: () => {
        this.noteSaving.set(false);
        this.closeNotePanel();
        this.loadRegistry(true);
      },
      error: (err: HttpErrorResponse) => {
        this.noteSaving.set(false);
        this.noteError.set(
          err?.error?.message ??
            (err.status === 404
              ? 'Zrestartuj serwer API i spróbuj ponownie.'
              : err?.message) ??
            'Nie udało się zapisać notatki.',
        );
      },
    });
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

  getCarLabel(id: number | null, withKey = false): string {
    if (!id) return 'Wybierz auto...';
    const car = this.rows().find(r => r.id === id);
    if (!car) return 'Wybierz auto...';

    const base = `${car.brand} ${car.model} — ${car.registration || 'brak tablic'}`;
    return withKey ? `${base} (Klucz: ${car.keyNumber || '—'})` : base;
  }

}
