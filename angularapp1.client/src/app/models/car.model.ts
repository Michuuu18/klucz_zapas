export interface Car {
  id: number;
  brand: string;
  model: string;
  registration: string;
  keyNumber: string;
  qrCode: string;
  status: 'FREE' | 'IN_USE' | 'LOST';
  heldBy?: string | null;
  takenAt?: string | null;
  returnedBy?: string | null;
  returnedAt?: string | null;
  lostAt?: string | null;
  lostBy?: string | null;
}

export interface CarWritePayload {
  brand: string;
  model: string;
  registration: string;
  keyNumber: string;
  qrCode: string;
}
export interface HistoryRecord {
  id: number;
  carId: number;
  user: string;
  userDisplayName: string;
  takenAt: string;
  returnedAt: string | null;
  returnedBy: string | null;
  returnedByDisplayName: string | null;
  durationMinutes: number | null;
  status: string;
}
