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
type StatusConfirmKind = 'lost' | 'found' | 'take' | 'return' | 'delete';
type QrVehicle = {
  key: string;
  brand: string;
  model: string;
  registration: string;
  original: Car | null;
  spare: Car | null;
};

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})


export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('settingsDropdown') settingsDropdownRef!: ElementRef;
  @ViewChild('qrDropdownRef') qrDropdownRef!: ElementRef;
  @ViewChild('qrKeyDropdownRef') qrKeyDropdownRef!: ElementRef;
  @ViewChild('historyDropdownRef') historyDropdownRef!: ElementRef;
  @ViewChild('editDropdownRef') editDropdownRef!: ElementRef;
  @ViewChild('brandFilterRef') brandFilterRef!: ElementRef;

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
    if (this.qrKeyDropdownOpen() && this.qrKeyDropdownRef && !this.qrKeyDropdownRef.nativeElement.contains(target)) {
      this.qrKeyDropdownOpen.set(false);
    }
    if (this.historyDropdownOpen() && this.historyDropdownRef && !this.historyDropdownRef.nativeElement.contains(target)) {
      this.historyDropdownOpen.set(false);
    }
    if (this.editDropdownOpen() && this.editDropdownRef && !this.editDropdownRef.nativeElement.contains(target)) {
      this.editDropdownOpen.set(false);
    }
    if (this.brandFilterOpen() && this.brandFilterRef && !this.brandFilterRef.nativeElement.contains(target)) {
      this.brandFilterOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmRow() && !this.isConfirmBusy()) {
      this.closeStatusConfirm();
    }
  }
  private static readonly AUTO_REFRESH_MS = 3000;
  private refreshTimer?: ReturnType<typeof setInterval>;

  readonly rows = signal<Car[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly returningId = signal<number | null>(null);
  readonly takingId = signal<number | null>(null);
  readonly lostActionId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);
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
  readonly qrKeyDropdownOpen = signal(false);
  readonly qrVehicleKey = signal<string | null>(null);
  readonly qrKeyKind = signal<KeyKind>('O');
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
  readonly brandFilter = signal<string | null>(null);
  readonly brandFilterOpen = signal(false);
  noteDraft = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  form: CarWritePayload = this.emptyForm();

  readonly qrCanGenerate = computed(
    () => this.qrCarId() !== null && this.qrKeyName().trim().length > 0,
  );
  readonly qrVehicles = computed(() => {
    const groups = new Map<string, QrVehicle>();
    for (const row of this.rows()) {
      const registration = row.registration?.trim() ?? '';
      const key = registration.toUpperCase() || `__id_${row.id}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          brand: row.brand,
          model: row.model,
          registration,
          original: null,
          spare: null,
        };
        groups.set(key, group);
      }
      if (this.carKeyKind(row) === 'Z') {
        group.spare = row;
      } else {
        group.original = row;
      }
    }
    return [...groups.values()];
  });
  readonly qrSelectedVehicle = computed(
    () => this.qrVehicles().find((item) => item.key === this.qrVehicleKey()) ?? null,
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
  readonly brands = computed(() => {
    const names = new Set<string>();
    for (const row of this.rows()) {
      const brand = row.brand?.trim();
      if (brand) names.add(brand);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
  });
  readonly emptyTableMessage = computed(() =>
    this.brandFilter() ? 'Brak aut dla wybranej marki.' : 'Brak aut w rejestrze.',
  );
  readonly tableRows = computed(() => {
    const brand = this.brandFilter();
    const list = brand
      ? this.rows().filter((row) => (row.brand || '').trim().toLowerCase() === brand.toLowerCase())
      : [...this.rows()];

    return list.sort((left, right) => {
      const leftRank = this.tableRowRank(left);
      const rightRank = this.tableRowRank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;

      if (left.status === 'IN_USE' && right.status === 'IN_USE') {
        const leftTaken = left.takenAt ? Date.parse(left.takenAt) : 0;
        const rightTaken = right.takenAt ? Date.parse(right.takenAt) : 0;
        return rightTaken - leftTaken;
      }

      if (left.status === 'LOST' && right.status === 'LOST') {
        const leftLost = left.lostAt ? Date.parse(left.lostAt) : 0;
        const rightLost = right.lostAt ? Date.parse(right.lostAt) : 0;
        return rightLost - leftLost;
      }

      const byBrand = (left.brand || '').localeCompare(right.brand || '', 'pl', { sensitivity: 'base' });
      if (byBrand !== 0) return byBrand;
      return (left.model || '').localeCompare(right.model || '', 'pl', { sensitivity: 'base' });
    });
  });

  private tableRowRank(row: Car): number {
    if (row.status === 'IN_USE') return 0;
    if (row.status === 'LOST') return 1;
    return 2;
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpen.set(!this.settingsMenuOpen());
  }

  toggleDarkMode(): void {
    this.themeService.toggleTheme();
  }

  setBrandFilter(brand: string | null): void {
    this.brandFilter.set(brand);
    this.brandFilterOpen.set(false);
  }

  toggleBrandFilter(): void {
    this.brandFilterOpen.set(!this.brandFilterOpen());
  }

  constructor(
    private readonly cars: CarService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private themeService: ThemeService
  ) {}
  isDarkMode(): boolean {
    return this.themeService.isDarkTheme;
  }

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
    }

    this.cars.getRegistry().subscribe({
      next: (data) => {
        this.rows.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
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
      this.qrVehicleKey.set(null);
      this.qrKeyKind.set('O');
      this.qrDropdownOpen.set(false);
      this.qrKeyDropdownOpen.set(false);
      this.showHistoryPanel.set(false);
      this.closeNotePanel();
      this.closeStatusConfirm();
    }
  }

  onQrVehicleSelect(key: string | null): void {
    this.qrVehicleKey.set(key);
    this.qrDataUrl.set(null);
    this.qrError.set('');
    const vehicle = this.qrVehicles().find((item) => item.key === key) ?? null;
    if (!vehicle) {
      this.qrCarId.set(null);
      this.qrKeyName.set('');
      return;
    }

    const preferred = this.vehicleHasKind(vehicle, this.qrKeyKind())
      ? this.qrKeyKind()
      : vehicle.original
        ? 'O'
        : 'Z';
    this.qrKeyKind.set(preferred);
    this.applyQrSelection();
  }

  onQrKeyKindSelect(kind: KeyKind): void {
    this.qrKeyKind.set(kind);
    this.qrDataUrl.set(null);
    this.applyQrSelection();
  }

  qrVehicleLabel(): string {
    const vehicle = this.qrSelectedVehicle();
    if (!vehicle) return 'Wybierz auto...';
    return `${vehicle.brand} ${vehicle.model} — ${vehicle.registration || 'brak tablic'}`;
  }

  qrKeySelectLabel(): string {
    if (!this.qrVehicleKey()) return 'Wybierz klucz...';
    return this.qrKeyKind() === 'Z' ? 'Klucz zapasowy' : 'Klucz oryginalny';
  }

  qrHasKeyKind(kind: KeyKind): boolean {
    const vehicle = this.qrSelectedVehicle();
    return vehicle ? this.vehicleHasKind(vehicle, kind) : false;
  }

  private applyQrSelection(): void {
    const vehicle = this.qrSelectedVehicle();
    const car = this.qrKeyKind() === 'Z' ? vehicle?.spare ?? null : vehicle?.original ?? null;
    this.qrCarId.set(car?.id ?? null);
    this.qrKeyName.set(car?.qrCode ?? '');
    if (this.qrVehicleKey() && !car) {
      this.qrError.set(
        this.qrKeyKind() === 'Z'
          ? 'To auto nie ma klucza zapasowego.'
          : 'To auto nie ma klucza oryginalnego.',
      );
    }
  }

  private vehicleHasKind(vehicle: QrVehicle, kind: KeyKind): boolean {
    return kind === 'Z' ? vehicle.spare != null : vehicle.original != null;
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
      const scanUrl = `${window.location.origin}/key/${encodeURIComponent(newCode)}`;
      const qrOnly = await QRCode.toDataURL(scanUrl, {
        width: 420,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      const label = await this.buildQrLabelImage(qrOnly, newCode, car);
      this.qrDataUrl.set(label);
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
    const code = this.qrKeyName().trim() || car?.qrCode || 'kod';
    const filename = `qr-${code}-${car?.registration ?? 'auto'}.png`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  private buildQrLabelImage(qrDataUrl: string, code: string, car: Car): Promise<string> {
    return new Promise((resolve, reject) => {
      const qrImage = new Image();
      qrImage.onload = () => {
        const frame = 20;
        const qrSize = 420;
        const footerHeight = 112;
        const width = qrSize + frame * 2;
        const height = frame + qrSize + frame + footerHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Brak canvas'));
          return;
        }

        const frameColor = '#0b1f33';

        // Góra: QR + gruba ramka tej samej szerokości co dolny box.
        ctx.fillStyle = frameColor;
        ctx.fillRect(0, 0, width, frame + qrSize + frame);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(frame, frame, qrSize, qrSize);
        ctx.drawImage(qrImage, frame, frame, qrSize, qrSize);

        // Dół: biały box równo pod ramką QR, te same lewa i prawa krawędź.
        const footerTop = frame + qrSize + frame;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, footerTop, width, footerHeight);

        const stroke = 4;
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = stroke;
        ctx.beginPath();
        ctx.moveTo(stroke / 2, footerTop);
        ctx.lineTo(stroke / 2, height - stroke / 2);
        ctx.lineTo(width - stroke / 2, height - stroke / 2);
        ctx.lineTo(width - stroke / 2, footerTop);
        ctx.stroke();

        const registration = (car.registration || 'BRAK TABLIC').toUpperCase();
        const brand = `${car.brand || ''} ${car.model || ''}`.trim().toUpperCase() || 'AUTO';
        const line1 = `KOD: ${code}`;
        const line2 = `${registration} ${brand}`;
        const textLeft = frame;
        const maxTextWidth = qrSize;

        ctx.fillStyle = frameColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.font = '700 28px Manrope, Segoe UI, sans-serif';
        ctx.fillText(this.fitCanvasText(ctx, line1, maxTextWidth), textLeft, footerTop + 40);

        ctx.font = '700 24px Manrope, Segoe UI, sans-serif';
        ctx.fillText(this.fitCanvasText(ctx, line2, maxTextWidth), textLeft, footerTop + 78);

        resolve(canvas.toDataURL('image/png'));
      };
      qrImage.onerror = () => reject(new Error('Nie udało się wczytać QR'));
      qrImage.src = qrDataUrl;
    });
  }

  private fitCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let value = text;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value}…`;
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

    const generated = this.formMode() === 'create'
      ? this.nextKeySlot(this.keyKind(), this.form.registration.trim())
      : null;
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

    if (this.formMode() === 'edit' && selected) {
      payload.qrCode = this.qrCodeForCar(
        selected.keyNumber,
        payload.registration,
        selected.qrCode,
      );
    }

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
    if (row.status !== 'FREE' || this.isConfirmBusy()) return;

    const qrCode = row.qrCode?.trim();
    if (!qrCode) {
      this.error.set('To auto nie ma przypisanego kodu QR — edytuj auto i uzupełnij kod.');
      return;
    }

    this.openStatusConfirm(row, 'take');
  }

  returnCar(row: Car): void {
    if (row.status !== 'IN_USE' || this.isConfirmBusy()) return;

    const loginId = this.auth.currentUser()?.username?.trim();
    if (!loginId) {
      this.error.set('Brak zalogowanego użytkownika.');
      return;
    }

    this.openStatusConfirm(row, 'return');
  }

  deleteFromForm(): void {
    const id = this.editingId();
    if (id == null || this.isConfirmBusy()) return;
    const row = this.rows().find((r) => r.id === id);
    if (!row) return;

    if (row.status === 'IN_USE') {
      this.formError.set('Nie można usunąć auta, które jest aktualnie w użyciu.');
      return;
    }

    this.formError.set('');
    this.openStatusConfirm(row, 'delete');
  }

  markLost(row: Car): void {
    if (this.isConfirmBusy()) return;

    const loginId = this.auth.currentUser()?.username?.trim();
    if (!loginId) {
      this.error.set('Brak zalogowanego użytkownika.');
      return;
    }

    this.openStatusConfirm(row, 'lost');
  }

  markFound(row: Car): void {
    if (row.status !== 'LOST' || this.isConfirmBusy()) return;
    this.openStatusConfirm(row, 'found');
  }

  openStatusConfirm(row: Car, kind: StatusConfirmKind): void {
    if (kind !== 'delete') {
      this.formMode.set('closed');
      this.showQrPanel.set(false);
      this.showHistoryPanel.set(false);
      this.closeNotePanel();
    }
    this.confirmKind.set(kind);
    this.confirmRow.set(row);
  }

  closeStatusConfirm(): void {
    if (this.isConfirmBusy()) return;
    this.confirmRow.set(null);
    this.confirmKind.set(null);
  }

  isConfirmSaving(id: number): boolean {
    return (
      this.lostActionId() === id ||
      this.takingId() === id ||
      this.returningId() === id ||
      this.deletingId() === id
    );
  }

  confirmTitle(): string {
    switch (this.confirmKind()) {
      case 'take':
        return 'Zabrać kluczyk?';
      case 'return':
        return 'Zwrócić kluczyk?';
      case 'found':
        return 'Oznaczyć jako znaleziony?';
      case 'delete':
        return 'Usunąć auto?';
      default:
        return 'Oznaczyć jako zagubiony?';
    }
  }

  confirmCopy(): string {
    switch (this.confirmKind()) {
      case 'take':
        return 'Kluczyk zostanie oznaczony jako w użyciu.';
      case 'return':
        return 'Kluczyk wróci do stanu wolny i będzie dostępny do wydania.';
      case 'found':
        return 'Ten kluczyk wróci do stanu wolny i będzie dostępny do wydania.';
      case 'delete':
        return 'Auto i jego kluczyk zostaną trwale usunięte z rejestru.';
      default:
        return 'Ten kluczyk zostanie zablokowany i nie będzie dostępny do wydania.';
    }
  }

  confirmHint(): string {
    switch (this.confirmKind()) {
      case 'take':
        return 'W historii pojawi się pobranie na Twoje konto administratora.';
      case 'return':
        return 'Notatka przy tym kluczyku zostanie zapisana w historii i wyczyszczona.';
      case 'found':
        return 'Auto pojawi się ponownie na liście jako wolne.';
      case 'delete':
        return 'Tej operacji nie można cofnąć.';
      default:
        return 'Stan możesz później zmienić przyciskiem „Znaleziony”.';
    }
  }

  confirmStatusChange(): void {
    const row = this.confirmRow();
    const kind = this.confirmKind();
    if (!row || !kind || this.isConfirmBusy()) return;

    this.error.set('');

    if (kind === 'take') {
      const qrCode = row.qrCode?.trim();
      if (!qrCode) {
        this.error.set('To auto nie ma przypisanego kodu QR — edytuj auto i uzupełnij kod.');
        return;
      }

      this.takingId.set(row.id);
      this.cars.takeCar(qrCode).subscribe({
        next: () => this.finishStatusAction('Kluczyk został zabrany.'),
        error: (err: HttpErrorResponse) =>
          this.failStatusAction(
            err?.error?.message ?? err?.message ?? 'Nie udało się zabrać auta.',
          ),
      });
      return;
    }

    if (kind === 'return') {
      const loginId = this.auth.currentUser()?.username?.trim();
      if (!loginId) {
        this.error.set('Brak zalogowanego użytkownika.');
        return;
      }

      this.returningId.set(row.id);
      this.cars.returnCarById(row.id, loginId).subscribe({
        next: () => {
          if (this.noteCarId() === row.id) {
            this.closeNotePanel();
          }
          this.finishStatusAction('Kluczyk został zwrócony.');
        },
        error: (err: HttpErrorResponse) =>
          this.failStatusAction(
            err?.error?.message ?? err?.message ?? 'Nie udało się zwrócić auta.',
          ),
      });
      return;
    }

    if (kind === 'lost') {
      const loginId = this.auth.currentUser()?.username?.trim();
      if (!loginId) {
        this.error.set('Brak zalogowanego użytkownika.');
        return;
      }

      this.lostActionId.set(row.id);
      this.cars.markLost(row.id, loginId).subscribe({
        next: () => this.finishStatusAction('Kluczyk został oznaczony jako zagubiony.'),
        error: (err: HttpErrorResponse) =>
          this.failStatusAction(
            err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako zagubiony.',
          ),
      });
      return;
    }

    if (kind === 'delete') {
      this.deletingId.set(row.id);
      this.formError.set('');
      this.cars.deleteCar(row.id).subscribe({
        next: () => {
          this.closeForm();
          this.finishStatusAction('Auto zostało usunięte.');
        },
        error: (err: HttpErrorResponse) => {
          const message =
            err?.error?.message ?? err?.message ?? 'Nie udało się usunąć auta.';
          this.formError.set(message);
          this.failStatusAction(message);
        },
      });
      return;
    }

    this.lostActionId.set(row.id);
    this.cars.markFound(row.id).subscribe({
      next: () => this.finishStatusAction('Kluczyk został oznaczony jako znaleziony.'),
      error: (err: HttpErrorResponse) =>
        this.failStatusAction(
          err?.error?.message ?? err?.message ?? 'Nie udało się oznaczyć kluczyka jako znaleziony.',
        ),
    });
  }

  private isConfirmBusy(): boolean {
    return (
      this.lostActionId() != null ||
      this.takingId() != null ||
      this.returningId() != null ||
      this.deletingId() != null
    );
  }

  private finishStatusAction(toast: string): void {
    this.lostActionId.set(null);
    this.takingId.set(null);
    this.returningId.set(null);
    this.deletingId.set(null);
    this.closeStatusConfirm();
    this.showToast(toast);
    this.loadRegistry(true);
  }

  private failStatusAction(message: string): void {
    this.lostActionId.set(null);
    this.takingId.set(null);
    this.returningId.set(null);
    this.deletingId.set(null);
    this.error.set(message);
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

  private nextKeySlot(kind: KeyKind, registration: string): { keyNumber: string; qrCode: string } {
    const takenKeys = new Set(
      this.rows().map((row) => row.keyNumber.trim().toUpperCase()),
    );
    const takenQrs = new Set(
      this.rows().map((row) => row.qrCode.trim().toUpperCase()),
    );
    const usedGlobalSlots = new Set<number>();

    for (const row of this.rows()) {
      const qrSlot = this.parseQrSlot(row.qrCode);
      if (qrSlot) usedGlobalSlots.add(qrSlot);
    }

    let kindSlot = 1;
    while (true) {
      const padded = String(kindSlot).padStart(2, '0');
      const keyNumber = `K-${kind}-${padded}`;
      if (!takenKeys.has(keyNumber.toUpperCase())) {
        break;
      }
      kindSlot += 1;
    }

    let globalSlot = 1;
    while (usedGlobalSlots.has(globalSlot)) {
      globalSlot += 1;
    }

    const keyNumber = `K-${kind}-${String(kindSlot).padStart(2, '0')}`;
    let qrCode = this.buildQrCode(globalSlot, registration);
    while (takenQrs.has(qrCode.toUpperCase())) {
      globalSlot += 1;
      qrCode = this.buildQrCode(globalSlot, registration);
    }

    return { keyNumber, qrCode };
  }

  private qrCodeForCar(keyNumber: string, registration: string, existingQr?: string | null): string {
    const slot =
      this.parseQrSlot(existingQr ?? '') ??
      this.parseKeySlot(keyNumber) ??
      1;
    return this.buildQrCode(slot, registration);
  }

  private buildQrCode(slot: number, registration: string): string {
    const xxx = slot >= 100 ? String(slot) : String(slot).padStart(2, '0');
    const digits = (registration || '').replace(/\D/g, '');
    const yy = digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0');
    return `${xxx}${yy}`;
  }

  private parseKeySlot(keyNumber: string): number | null {
    const match = keyNumber?.trim().match(/^K-[OZ]-(\d+)$/i);
    return match ? Number(match[1]) : null;
  }

  private parseQrSlot(qrCode: string): number | null {
    const legacy = qrCode?.trim().match(/^QR-[OZ]-(\d+)$/i);
    if (legacy) return Number(legacy[1]);
    const modern = qrCode?.trim().match(/^(\d{2,3})(\d{2})$/);
    return modern ? Number(modern[1]) : null;
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
    return withKey ? `${base} (Klucz: ${this.keyKindLabel(car)})` : base;
  }

  carKeyKind(car: Car): KeyKind {
    return this.keyKindLabel(car) === 'Zapasowy' ? 'Z' : 'O';
  }

  keyKindLabel(car: Car): string {
    const key = car.keyNumber?.trim().toUpperCase() ?? '';
    if (key.includes('-Z-') || key.startsWith('K-Z')) return 'Klucz zapasowy';
    return 'Klucz oryginalny';
  }

}
