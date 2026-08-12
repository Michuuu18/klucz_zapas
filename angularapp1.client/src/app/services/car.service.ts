import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Car } from '../models/car.model';

@Injectable({ providedIn: 'root' })
export class CarService {
  private readonly apiUrl = '/api/cars';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Car[]> {
    return this.http.get<Car[]>(this.apiUrl);
  }

  getByQrCode(code: string): Observable<Car> {
    return this.http.get<Car>(`${this.apiUrl}/by-qr/${encodeURIComponent(code)}`);
  }

  takeCar(qrCode: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/take`, { qrCode });
  }

  returnCar(qrCode: string): Observable<Car> {
    return this.http.post<Car>(`${this.apiUrl}/return`, { qrCode });
  }
}
