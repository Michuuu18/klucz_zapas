import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Car, CarWritePayload, HistoryRecord } from '../models/car.model';

// Klient HTTP do API rejestru kluczy.
@Injectable({ providedIn: 'root' })
export class CarService {
  private readonly apiUrl = '/api/cars';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Car[]> {
    return this.http.get<Car[]>(this.apiUrl);
  }

  getRegistry(): Observable<Car[]> {
    return this.http.get<Car[]>(`${this.apiUrl}/registry`);
  }

  getByQrCode(code: string): Observable<Car> {
    return this.http.get<Car>(`${this.apiUrl}/by-qr/${encodeURIComponent(code)}`);
  }

  createCar(payload: CarWritePayload): Observable<Car> {
    return this.http.post<Car>(this.apiUrl, payload);
  }

  updateCar(id: number, payload: CarWritePayload): Observable<Car> {
    return this.http.put<Car>(`${this.apiUrl}/${id}`, payload);
  }

  deleteCar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  takeCar(qrCode: string, force = false): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/take`, { qrCode, force });
  }

  returnCar(qrCode: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/return`, { qrCode });
  }

  returnCarById(id: number, loginId: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/${id}/return`, { loginId });
  }

  markLost(id: number, markedBy: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/${id}/lost`, { markedBy });
  }

  markFound(id: number): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/${id}/found`, {});
  }

  updateNote(id: number, note: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/${id}/note`, { note });
  }

  getHistory(carId: number): Observable<HistoryRecord[]> {
    return this.http.get<HistoryRecord[]>(`${this.apiUrl}/${carId}/history`);
  }
}
