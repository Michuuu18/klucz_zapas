export interface Car {
  id: number;
  brand: string;
  registration: string;
  keyNumber: string;
  qrCode: string;
  status: 'FREE' | 'IN_USE';
}
