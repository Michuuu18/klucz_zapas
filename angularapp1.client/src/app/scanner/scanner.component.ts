import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';

type CameraStatus = 'loading' | 'active' | 'denied' | 'error';

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
      ? 'Zeskanuj kluczyk QR (Oddaj auto)'
      : 'Zeskanuj kluczyk QR (Zabierz auto)';
  }

  async ngAfterViewInit(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Ta przeglądarka nie obsługuje kamery. Użyj Chrome lub Edge.',
        );
      }

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error('Nie wykryto żadnej kamery w tym urządzeniu.');
      }

      const cameraId = this.pickCameraId(cameras);
      const config = this.buildScanConfig();

      this.html5QrCode = new Html5Qrcode(this.scannerElementId, {
        verbose: false,
      });

      await this.html5QrCode.start(
        cameraId,
        config,
        (decodedText) => void this.onScanSuccess(decodedText),
        () => undefined,
      );

      this.cameraStatus = 'active';
      this.cdr.detectChanges();
    } catch (error) {
      await this.stopScanner();
      this.cameraStatus = 'denied';
      this.cameraError = this.getCameraErrorMessage(error);
      this.cdr.detectChanges();
    }
  }

  submitManualCode(): void {
    const code = this.manualCode.trim();
    if (!code) {
      return;
    }

    void this.stopScanner();
    this.router.navigate(['/key', code], {
      queryParams: { mode: this.mode },
    });
  }

  private pickCameraId(
    cameras: Array<{ id: string; label: string }>,
  ): string {
    const back = cameras.find((camera) =>
      /back|rear|environment|tyl/i.test(camera.label),
    );
    return back?.id ?? cameras[cameras.length - 1].id ?? cameras[0].id;
  }

  private buildScanConfig() {
    const viewport = document.getElementById(this.scannerElementId);
    const viewWidth = viewport?.clientWidth || 400;
    const viewHeight = viewport?.clientHeight || 420;
    const scanSize = Math.max(
      180,
      Math.floor(Math.min(viewWidth, viewHeight) * 0.7),
    );

    return {
      fps: 10,
      qrbox: { width: scanSize, height: scanSize },
      aspectRatio: viewWidth / viewHeight,
      disableFlip: false,
    };
  }

  private async onScanSuccess(decodedText: string): Promise<void> {
    if (this.scanHandled) {
      return;
    }

    this.scanHandled = true;
    await this.stopScanner();

    const code = this.extractCode(decodedText);
    this.router.navigate(['/key', code], {
      queryParams: { mode: this.mode },
    });
  }

  private extractCode(text: string): string {
    const trimmed = text.trim();
    const fromPath = trimmed.match(/\/key\/([^/?#]+)/i);

    if (fromPath) {
      return decodeURIComponent(fromPath[1]);
    }

    return trimmed;
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
      // already stopped
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

    if (message.trim()) {
      return message;
    }

    return 'Nie udało się uruchomić kamery.';
  }
}
