import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';

type CameraStatus = 'loading' | 'active' | 'denied' | 'error';
type CameraSource = string | { facingMode: ConciseFacingMode };
type ConciseFacingMode = 'environment' | 'user';

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
})
export class ScannerComponent implements AfterViewInit, OnDestroy {
  readonly scannerElementId = 'qr-reader';

  manualCode = '';
  cameraStatus: CameraStatus = 'loading';
  cameraError = '';

  private html5QrCode: Html5Qrcode | null = null;
  private scanHandled = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get mode(): string {
    return this.route.snapshot.queryParamMap.get('mode') ?? 'take';
  }

  get pageTitle(): string {
    return this.mode === 'return'
      ? 'Zeskanuj kluczyk QR (Oddaj klucz)'
      : 'Zeskanuj kluczyk QR (Zbierz klucz)';
  }

  async ngAfterViewInit(): Promise<void> {
    // Krótka pauza: DOM musi mieć gotowy #qr-reader (szczególnie Safari/iOS).
    await new Promise((resolve) => setTimeout(resolve, 120));
    await this.startScanner();
  }

  ngOnDestroy(): void {
    void this.stopScanner();
  }

  async startScanner(): Promise<void> {
    this.cameraStatus = 'loading';
    this.cameraError = '';
    this.scanHandled = false;
    this.cdr.detectChanges();

    await this.stopScanner();

    try {
      if (!window.isSecureContext) {
        throw new Error(
          'Kamera wymaga bezpiecznego połączenia (HTTPS).',
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Ta przeglądarka nie obsługuje kamery. Użyj Chrome lub Edge.',
        );
      }

      // Najpierw prośba o uprawnienie — na iOS/Brave etykiety kamer pojawiają się dopiero potem.
      await this.warmUpCameraPermission();

      this.html5QrCode = new Html5Qrcode(this.scannerElementId, {
        verbose: false,
      });

      const sources = await this.buildCameraSources();
      let lastError: unknown;

      for (const source of sources) {
        for (const config of this.buildScanConfigs()) {
          try {
            await this.html5QrCode.start(
              source,
              config,
              (decodedText) => void this.onScanSuccess(decodedText),
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

  submitManualCode(): void {
    const code = this.normalizeCode(this.manualCode);
    if (!code) {
      return;
    }

    void this.stopScanner();
    this.router.navigate(['/key', code], {
      queryParams: { mode: this.mode },
    });
  }

  private async warmUpCameraPermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      for (const track of stream.getTracks()) {
        track.stop();
      }
    } catch {
      // Jeśli tu padnie, właściwy start i tak spróbuje i pokaże czytelny błąd.
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
        const preferredId = this.pickCameraId(cameras);
        sources.push(preferredId);
        for (const camera of cameras) {
          if (camera.id !== preferredId) {
            sources.push(camera.id);
          }
        }
      }
    } catch {
      // Brak listy kamer — zostają facingMode.
    }

    return sources;
  }

  private pickCameraId(
    cameras: Array<{ id: string; label: string }>,
  ): string {
    const back = cameras.find((camera) =>
      /back|rear|environment|tyl|traseira|achter/i.test(camera.label),
    );
    return back?.id ?? cameras[cameras.length - 1]?.id ?? cameras[0].id;
  }

  private buildScanConfigs(): Html5QrcodeCameraScanConfig[] {
    const viewport = document.getElementById(this.scannerElementId);
    const viewWidth = Math.max(viewport?.clientWidth || 320, 240);
    const viewHeight = Math.max(viewport?.clientHeight || 360, 240);
    const scanSize = Math.max(
      160,
      Math.min(280, Math.floor(Math.min(viewWidth, viewHeight) * 0.65)),
    );

    // Najpierw pełniejsza konfiguracja, potem uproszczona (Safari/Brave bywają kapryśne).
    return [
      {
        fps: 10,
        qrbox: { width: scanSize, height: scanSize },
        aspectRatio: 1,
        disableFlip: false,
      },
      {
        fps: 8,
        qrbox: scanSize,
        disableFlip: false,
      },
      {
        fps: 8,
        disableFlip: false,
      },
    ];
  }

  private applyVideoCompatibilityFixes(): void {
    const root = document.getElementById(this.scannerElementId);
    if (!root) return;

    const video = root.querySelector('video');
    if (!video) return;

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.setAttribute('muted', 'true');
    video.autoplay = true;

    // Niektóre przeglądarki mobilne pauzują stream po starcie.
    void video.play().catch(() => undefined);
  }

  private async onScanSuccess(decodedText: string): Promise<void> {
    if (this.scanHandled) {
      return;
    }

    this.scanHandled = true;
    await this.stopScanner();

    const code = this.normalizeCode(decodedText);
    if (!code) {
      this.scanHandled = false;
      await this.startScanner();
      return;
    }

    this.router.navigate(['/key', code], {
      queryParams: { mode: this.mode },
      replaceUrl: true,
    });
  }

  private normalizeCode(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }

    const fromPath = trimmed.match(/\/key\/([^/?#]+)/i);
    if (fromPath?.[1]) {
      return decodeURIComponent(fromPath[1]).trim();
    }

    try {
      const asUrl = new URL(trimmed);
      const keyMatch = asUrl.pathname.match(/\/key\/([^/]+)/i);
      if (keyMatch?.[1]) {
        return decodeURIComponent(keyMatch[1]).trim();
      }
    } catch {
      // zwykły kod, nie URL
    }

    return trimmed;
  }

  private async safeStopCurrent(): Promise<void> {
    if (!this.html5QrCode) return;

    try {
      if (this.html5QrCode.isScanning) {
        await this.html5QrCode.stop();
      }
    } catch {
      // ignore
    }

    try {
      this.html5QrCode.clear();
    } catch {
      // ignore
    }

    const element = document.getElementById(this.scannerElementId);
    if (element) {
      element.innerHTML = '';
    }

    this.html5QrCode = new Html5Qrcode(this.scannerElementId, {
      verbose: false,
    });
  }

  private async stopScanner(): Promise<void> {
    if (!this.html5QrCode) {
      const element = document.getElementById(this.scannerElementId);
      if (element) {
        element.innerHTML = '';
      }
      return;
    }

    try {
      if (this.html5QrCode.isScanning) {
        await this.html5QrCode.stop();
      }
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
    if (element) {
      element.innerHTML = '';
    }
  }

  private getCameraErrorMessage(error: unknown): string {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error ?? '');

    const lower = message.toLowerCase();

    if (
      lower.includes('notallowed') ||
      lower.includes('permission') ||
      lower.includes('denied')
    ) {
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

    if (
      lower.includes('secure') ||
      lower.includes('https') ||
      lower.includes('insecure')
    ) {
      return message;
    }

    if (message.trim()) {
      return message;
    }

    return 'Nie udało się uruchomić kamery.';
  }
}
