# System kluczykowy (Angular + ASP.NET Core)

Aplikacja do pobierania i oddawania kluczyków samochodowych.

## Struktura

- `angularapp1.client` — frontend Angular
- `AngularApp1.Server` — backend ASP.NET Core (API)

## Jak uruchomić

Muszą działać **dwa procesy** naraz:

### 1. Backend (API) — w pierwszym terminalu

```bash
cd AngularApp1.Server
dotnet run --launch-profile api
```

API działa na: `http://localhost:5296`

### 2. Frontend — w drugim terminalu

```bash
cd angularapp1.client
npm start
```

Wejdź na: `https://localhost:52728`

### Albo Visual Studio

1. Otwórz `AngularApp1.slnx`
2. Startowy projekt: **AngularApp1.Server**
3. Profil: **https** (odpala API + frontend przez SpaProxy)
4. **F5**

> Jeśli widzisz „Ładowanie danych pojazdu…” bez końca — backend nie działa. Uruchom `dotnet run --launch-profile api`.

## Jak korzystać

1. Na ekranie głównym wybierz **ZABIERZ AUTO** lub **ODDAJ AUTO**
2. Zeskanuj kod QR albo wpisz kod ręcznie (np. `QR001`)
3. Sprawdź dane pojazdu i potwierdź

## Kody testowe

| Kod   | Samochód           | Rejestracja |
|-------|--------------------|-------------|
| QR001 | Toyota Corolla     | BB 1234A    |
| QR002 | Volkswagen Passat  | BB 5678B    |
| QR003 | Skoda Octavia      | SB 9012C    |
| QR004 | Ford Transit       | BB 3456D    |
| QR005 | BMW 320d           | KR 7890E    |

## API

- `GET /api/cars`
- `GET /api/cars/by-qr/{code}`
- `POST /api/cars/take` `{ "qrCode": "QR001" }`
- `POST /api/cars/return` `{ "qrCode": "QR001" }`
