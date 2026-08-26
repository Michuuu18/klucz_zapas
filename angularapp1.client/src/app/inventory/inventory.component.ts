import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Car } from '../models/car.model';
import { CarService } from '../services/car.service';

type CameraStatus = 'loading' | 'active' | 'denied' | 'error';
type CameraSource = string | { facingMode: ConciseFacingMode };
type ConciseFacingMode = 'environment' | 'user';
type InventoryPhase = 'scan' | 'report';
type ScanFlag = 'ok' | 'attention' | 'unknown';

type ScanEntry = {
  qrCode: string;
  carId: number | null;
  registration: string;
  brand: string;
  model: string;
  keyKind: string;
  status: Car['status'] | null;
  heldBy: string | null;
  flag: ScanFlag;
  scannedAt: number;
};

type ReportRow = {
  car: Car;
  keyKind: string;
  category: 'check' | 'missing' | 'ok' | 'out';
  detail: string;
};

@Component({
  selector: 'app-inventory',
  standalone: false,
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly scannerElementId = 'inventory-qr-reader';

  phase: InventoryPhase = 'scan';
  cameraStatus: CameraStatus = 'loading';
  cameraError = '';
  manualCode = '';
  toastMessage = '';
  loadingRegistry = true;
  registryError = '';

  readonly cars = signal<Car[]>([]);
  readonly scans = signal<ScanEntry[]>([]);
  readonly showOkSection = signal(false);

  readonly scannedCount = computed(() => this.scans().filter((s) => s.carId != null).length);
  readonly totalCount = computed(() => this.cars().length);
  readonly recentScans = computed(() => this.scans().slice(0, 5));

  readonly reportRows = computed(() => this.buildReportRows());
  readonly checkRows = computed(() => this.reportRows().filter((r) => r.category === 'check'));
  readonly missingRows = computed(() => this.reportRows().filter((r) => r.category === 'missing'));
  readonly okRows = computed(() => this.reportRows().filter((r) => r.category === 'ok'));
  readonly outRows = computed(() => this.reportRows().filter((r) => r.category === 'out'));
  readonly unknownScans = computed(() => this.scans().filter((s) => s.flag === 'unknown'));

  private html5QrCode: Html5Qrcode | null = null;
  private scanLockUntil = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private carsByQr = new Map<string, Car>();

  constructor(
    private readonly carsApi: CarService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.carsApi.getRegistry().subscribe({
      next: (data) => {
        this.cars.set(data);
        this.carsByQr = new Map(
          data.map((car) => [car.qrCode.trim().toLowerCase(), car]),
        );
        this.loadingRegistry = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRegistry = false;
        this.registryError = 'Nie udało się pobrać rejestru kluczy.';
        this.cdr.detectChanges();
      },
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (this.phase === 'scan') {
      await this.startScanner();
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    void this.stopScanner();
  }

  goBack(): void {
    void this.stopScanner();
    this.router.navigate(['/admin']);
  }

  async finishAndShowReport(): Promise<void> {
    await this.stopScanner();
    this.phase = 'report';
    this.showOkSection.set(false);
    this.cdr.detectChanges();
  }

  async continueScanning(): Promise<void> {
    this.phase = 'scan';
    this.cdr.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 80));
    await this.startScanner();
  }

  clearSession(): void {
    this.scans.set([]);
    this.showToast('Wyczyszczono listę skanów.');
  }

  submitManualCode(): void {
    const code = this.normalizeCode(this.manualCode);
    if (!code) return;
    this.registerScan(code);
    this.manualCode = '';
  }

  statusLabel(status: string | null): string {
    if (status === 'IN_USE') return 'W użyciu';
    if (status === 'LOST') return 'Zagubiony';
    if (status === 'FREE') return 'Wolne';
    return 'Nieznany';
  }

  keyKindLabel(car: Car): string {
    const key = car.keyNumber?.trim().toUpperCase() ?? '';
    if (key.includes('-Z-') || key.startsWith('K-Z')) return 'Zapasowy';
    return 'Oryginalny';
  }

  async startScanner(): Promise<void> {
    if (this.phase !== 'scan') return;

    this.cameraStatus = 'loading';
    this.cameraError = '';
    this.cdr.detectChanges();
    await this.stopScanner();

    try {
      if (!window.isSecureContext) {
        throw new Error('Kamera wymaga bezpiecznego połączenia (HTTPS).');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Ta przeglądarka nie obsługuje kamery. Użyj Chrome lub Edge.');
      }

      await this.warmUpCameraPermission();
      this.html5QrCode = new Html5Qrcode(this.scannerElementId, { verbose: false });

      const sources = await this.buildCameraSources();
      let lastError: unknown;

      for (const source of sources) {
        for (const config of this.buildScanConfigs()) {
          try {
            await this.html5QrCode.start(
              source,
              config,
              (decodedText) => this.onScanSuccess(decodedText),
              () => undefined,
            );
            this.applyVideoCompatibilityFixes();
            this.cameraStatus = 'active';
            this.cdr.detectChanges();
            return;
          } catch (error) {
            lastError = error;
            await this.safeStopCurrent();
          }
        }
      }

      throw lastError ?? new Error('Nie udało się uruchomić kamery.');
    } catch (error) {
      await this.stopScanner();
      this.cameraStatus = 'denied';
      this.cameraError = this.getCameraErrorMessage(error);
      this.cdr.detectChanges();
    }
  }

  private onScanSuccess(decodedText: string): void {
    if (Date.now() < this.scanLockUntil) return;
    const code = this.normalizeCode(decodedText);
    if (!code) return;
    this.scanLockUntil = Date.now() + 1200;
    this.registerScan(code);
  }

  private registerScan(code: string): void {
    const normalized = code.trim().toLowerCase();
    const already = this.scans().some((s) => s.qrCode.toLowerCase() === normalized);
    if (already) {
      this.showToast('Ten klucz był już zeskanowany.');
      return;
    }

    const car = this.carsByQr.get(normalized) ?? null;
    if (!car) {
      const entry: ScanEntry = {
        qrCode: code,
        carId: null,
        registration: '—',
        brand: '',
        model: '',
        keyKind: '—',
        status: null,
        heldBy: null,
        flag: 'unknown',
        scannedAt: Date.now(),
      };
      this.scans.update((list) => [entry, ...list]);
      this.showToast('Nieznany kod QR.');
      this.cdr.detectChanges();
      return;
    }

    const status = car.status;
    const flag: ScanFlag =
      status === 'IN_USE' || status === 'LOST' ? 'attention' : 'ok';

    const entry: ScanEntry = {
      qrCode: car.qrCode,
      carId: car.id,
      registration: car.registration || '—',
      brand: car.brand,
      model: car.model,
      keyKind: this.keyKindLabel(car),
      status,
      heldBy: car.heldBy ?? null,
      flag,
      scannedAt: Date.now(),
    };

    this.scans.update((list) => [entry, ...list]);
    this.showToast(
      flag === 'attention'
        ? `${entry.registration} · ${this.statusLabel(status)} — do sprawdzenia`
        : `${entry.registration} · OK`,
    );
    this.cdr.detectChanges();
  }

  private buildReportRows(): ReportRow[] {
    const scannedIds = new Set(
      this.scans()
        .map((s) => s.carId)
        .filter((id): id is number => id != null),
    );

    const rows: ReportRow[] = [];

    for (const car of this.cars()) {
      const scanned = scannedIds.has(car.id);
      const keyKind = this.keyKindLabel(car);

      if (scanned && car.status === 'FREE') {
        rows.push({
          car,
          keyKind,
          category: 'ok',
          detail: 'Zeskanowany · w systemie wolny',
        });
        continue;
      }

      if (scanned && car.status === 'IN_USE') {
        rows.push({
          car,
          keyKind,
          category: 'check',
          detail: `Zeskanowany w szafce, a w systemie W użyciu${car.heldBy ? ` (${car.heldBy})` : ''}`,
        });
        continue;
      }

      if (scanned && car.status === 'LOST') {
        rows.push({
          car,
          keyKind,
          category: 'check',
          detail: 'Zeskanowany fizycznie, a w systemie Zagubiony',
        });
        continue;
      }

      if (!scanned && car.status === 'FREE') {
        rows.push({
          car,
          keyKind,
          category: 'missing',
          detail: 'W systemie wolny, ale nie zeskanowano',
        });
        continue;
      }

      if (!scanned && car.status === 'IN_USE') {
        rows.push({
          car,
          keyKind,
          category: 'out',
          detail: `Prawdopodobnie poza firmą${car.heldBy ? ` · ${car.heldBy}` : ''}`,
        });
        continue;
      }

      if (!scanned && car.status === 'LOST') {
        rows.push({
          car,
          keyKind,
          category: 'out',
          detail: 'Nadal brak (zagubiony w systemie)',
        });
      }
    }

    return rows;
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this.toastMessage === message) this.toastMessage = '';
      this.cdr.detectChanges();
    }, 2200);
    this.cdr.detectChanges();
  }

  private normalizeCode(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';

    const fromPath = trimmed.match(/\/key\/([^/?#]+)/i);
    if (fromPath?.[1]) return decodeURIComponent(fromPath[1]).trim();

    try {
      const asUrl = new URL(trimmed);
      const keyMatch = asUrl.pathname.match(/\/key\/([^/]+)/i);
      if (keyMatch?.[1]) return decodeURIComponent(keyMatch[1]).trim();
    } catch {
      // zwykły kod
    }

    return trimmed;
  }

  private async warmUpCameraPermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      for (const track of stream.getTracks()) track.stop();
    } catch {
      // właściwy start i tak spróbuje
    }
  }

  private async buildCameraSources(): Promise<CameraSource[]> {
    const sources: CameraSource[] = [
      { facingMode: 'environment' },
      { facingMode: 'user' },
    ];

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length) {
        const preferred =
          cameras.find((c) => /back|rear|environment|tyl/i.test(c.label))?.id ??
          cameras[cameras.length - 1]?.id ??
          cameras[0].id;
        sources.push(preferred);
        for (const camera of cameras) {
          if (camera.id !== preferred) sources.push(camera.id);
        }
      }
    } catch {
      // facingMode only
    }

    return sources;
  }

  private buildScanConfigs(): Html5QrcodeCameraScanConfig[] {
    const viewport = document.getElementById(this.scannerElementId);
    const viewWidth = Math.max(viewport?.clientWidth || 320, 240);
    const viewHeight = Math.max(viewport?.clientHeight || 280, 240);
    const scanSize = Math.max(
      140,
      Math.min(240, Math.floor(Math.min(viewWidth, viewHeight) * 0.65)),
    );

    return [
      { fps: 10, qrbox: { width: scanSize, height: scanSize }, aspectRatio: 1, disableFlip: false },
      { fps: 8, qrbox: scanSize, disableFlip: false },
      { fps: 8, disableFlip: false },
    ];
  }

  private applyVideoCompatibilityFixes(): void {
    const root = document.getElementById(this.scannerElementId);
    const video = root?.querySelector('video');
    if (!video) return;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    void video.play().catch(() => undefined);
  }

  private async safeStopCurrent(): Promise<void> {
    if (!this.html5QrCode) return;
    try {
      if (this.html5QrCode.isScanning) await this.html5QrCode.stop();
    } catch {
      // ignore
    }
    try {
      this.html5QrCode.clear();
    } catch {
      // ignore
    }
    const element = document.getElementById(this.scannerElementId);
    if (element) element.innerHTML = '';
    this.html5QrCode = new Html5Qrcode(this.scannerElementId, { verbose: false });
  }

  private async stopScanner(): Promise<void> {
    if (!this.html5QrCode) {
      const element = document.getElementById(this.scannerElementId);
      if (element) element.innerHTML = '';
      return;
    }

    try {
      if (this.html5QrCode.isScanning) await this.html5QrCode.stop();
    } catch {
      // ignore
    }
    try {
      this.html5QrCode.clear();
    } catch {
      // ignore
    }
    this.html5QrCode = null;
    const element = document.getElementById(this.scannerElementId);
    if (element) element.innerHTML = '';
  }

  private getCameraErrorMessage(error: unknown): string {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error ?? '');
    const lower = message.toLowerCase();

    if (lower.includes('notallowed') || lower.includes('permission') || lower.includes('denied')) {
      return 'Brak dostępu do kamery. Zezwól na kamerę w przeglądarce i kliknij „Włącz kamerę”.';
    }
    if (lower.includes('notfound') || lower.includes('requested device not found')) {
      return 'Nie wykryto kamery w tym urządzeniu.';
    }
    if (
      lower.includes('notreadable') ||
      lower.includes('could not start video source') ||
      lower.includes('device in use') ||
      lower.includes('track start failed') ||
      lower.includes('aborterror')
    ) {
      return 'Kamera jest zajęta przez inną aplikację lub kartę. Zamknij ją i kliknij „Włącz kamerę”.';
    }
    if (lower.includes('overconstrained')) {
      return 'Wybrana kamera nie jest dostępna. Kliknij „Włącz kamerę” ponownie.';
    }
    if (message.trim()) return message;
    return 'Nie udało się uruchomić kamery.';
  }
}
