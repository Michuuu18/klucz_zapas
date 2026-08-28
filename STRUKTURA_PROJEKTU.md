# Struktura projektu — System kluczykowy (klucz_zapas)

Repo: https://github.com/Michuuu18/klucz_zapas

Projekt to solucja **AngularApp1.slnx** złożona z dwóch aktywnych projektów:
- **`AngularApp1.Server/`** — backend (ASP.NET Core / C# / PostgreSQL)
- **`angularapp1.client/`** — frontend (Angular / TypeScript / SCSS)

> ⚠️ W repo są też foldery `backend/` i `src/` w katalogu głównym — to pozostałości po wcześniejszym podejściu i **nie są** częścią aktywnej solucji (nie ma ich w `AngularApp1.slnx`). Można je zignorować przy edycji.

---

## 🖥️ Backend — `AngularApp1.Server/`

| Ścieżka | Co tam jest |
|---|---|
| `Controllers/CarsController.cs` | **Główna logika API** — zabieranie/zwracanie kluczy, statusy (wolne/w użyciu/zagubione), historia, QR, CRUD aut |
| `Controllers/AuthController.cs` | Logowanie, wydawanie tokenów JWT |
| `Models/Car.cs` | Model auta/klucza (marka, model, tablice, status, kod QR, itd.) |
| `Models/CarLog.cs`, `Models/CarHistoryRecord.cs` | Model wpisów historii (kto zabrał/zwrócił) |
| `Models/User.cs` | Model użytkownika (login, rola) |
| `Services/CarStore.cs` | Logika biznesowa operacji na autach (pośrednik między kontrolerem a bazą) |
| `Services/UserStore.cs` | Logika użytkowników / kont testowych |
| `Services/JwtService.cs` | Generowanie i walidacja tokenów JWT |
| `Services/DbInitializer.cs` | Wypełnianie bazy danymi startowymi (przykładowe auta, konta) |
| `Data/AppDbContext.cs` | Kontekst EF Core — połączenie z PostgreSQL, `DbSet`-y |
| `Migrations/` | Migracje bazy danych (Entity Framework) — **nie edytować ręcznie**, generować przez `dotnet ef migrations add ...` |
| `Authorization/RoleRequirement.cs` | Autoryzacja wg roli (admin / pracownik) |
| `appsettings.json`, `appsettings.Development.json` | Connection string do PostgreSQL, konfiguracja JWT |
| `Program.cs` | Punkt startowy API — rejestracja serwisów, middleware, routing |

**Chcesz dodać nowy endpoint / zmienić logikę operacji na autach →** `Controllers/CarsController.cs` + `Services/CarStore.cs`

---

## 🌐 Frontend — `angularapp1.client/src/app/`

| Ścieżka | Co tam jest |
|---|---|
| `admin/admin.component.ts` `.html` `.scss` | **Panel administratora** — cały rejestr aut, filtry, formularze, QR, historia, menu akcji przy wierszu (to, co ostatnio edytowaliśmy) |
| `home/` | Panel pracownika — ekran startowy (zabierz/oddaj) |
| `scanner/` | Skaner kodów QR (kamera / wpis ręczny) |
| `key-details/` | Widok szczegółów po zeskanowaniu klucza (potwierdzenie zabrania/zwrotu) |
| `login/` | Ekran logowania |
| `inventory/` | Widok inwentarza / skanowania kluczy z panelu admina |
| `services/car.service.ts` | **Klient HTTP do API `/api/cars`** — wszystkie wywołania związane z autami (get, create, update, delete, take, return, mark lost/found, historia) |
| `services/auth.service.ts` | Logowanie, przechowywanie tokenu, aktualny użytkownik |
| `models/car.model.ts` | Typy TypeScript: `Car`, `CarWritePayload`, `HistoryRecord` |
| `models/user.model.ts` | Typ użytkownika |
| `interceptors/auth.interceptor.ts` | Dokładanie tokenu JWT do każdego zapytania HTTP |
| `guards/auth.guard.ts` | Ochrona tras (np. `/admin` tylko dla zalogowanych/adminów) |
| `app-routing-module.ts` | Definicje ścieżek (`/admin`, `/panel`, `/login` itd.) |
| `app-module.ts` | Rejestracja modułów/komponentów Angulara |
| `theme.ts` | Obsługa jasnego/ciemnego motywu |

**Chcesz zmienić wygląd/zachowanie panelu admina →** `admin/admin.component.ts` (logika) + `.html` (szablon) + `.scss` (style)
**Chcesz dodać nowe wywołanie do API →** `services/car.service.ts`
**Chcesz dodać nowe pole na aucie →** `models/car.model.ts` (frontend) + `Models/Car.cs` (backend) + nowa migracja EF

---

## 🔑 Najczęstsze miejsca do edycji

| Chcę zmienić... | Otwórz plik(i) |
|---|---|
| Coś w panelu admina (przyciski, menu, tabelę) | `angularapp1.client/src/app/admin/admin.component.*` |
| Logikę zabierania/zwracania/gubienia kluczy (frontend) | `angularapp1.client/src/app/services/car.service.ts` |
| Logikę zabierania/zwracania/gubienia kluczy (backend) | `AngularApp1.Server/Controllers/CarsController.cs` |
| Wygląd ekranu skanera dla pracownika | `angularapp1.client/src/app/scanner/` |
| Ekran logowania | `angularapp1.client/src/app/login/` |
| Uprawnienia / role | `AngularApp1.Server/Authorization/`, `guards/auth.guard.ts` |
| Strukturę bazy danych | `AngularApp1.Server/Models/`, potem migracja w `Migrations/` |
| Connection string do bazy | `AngularApp1.Server/appsettings.Development.json` |

---

## ▶️ Uruchomienie (skrót z README)

1. `1-URUCHOM-API.bat` — startuje backend (`AngularApp1.Server`, port `5296`)
2. `2-URUCHOM-FRONT.bat` — startuje frontend (`angularapp1.client`, `https://localhost:4200`)

Konta testowe: `admin` / `admin123` (administrator), `pracownik` / `pracownik123` (pracownik).
