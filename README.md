# System kluczykowy

Prosta aplikacja do zabierania i oddawania kluczykow samochodowych.
Frontend: Angular. Backend: ASP.NET Core + PostgreSQL.

## 1. Przygotuj baze w pgAdmin

1. Otworz pgAdmin.
2. Polacz sie z serwerem PostgreSQL (localhost).
3. PPM na Databases -> Create -> Database.
4. Name: `system_kluczykowy`
5. Save.

## 2. Ustaw haslo w projekcie

Otworz plik:
`AngularApp1.Server/appsettings.json`

Zmien:
```
Password=TWOJE_HASLO
```
na haslo uzytkownika `postgres` z instalacji PostgreSQL.

Zrob to samo w:
`AngularApp1.Server/appsettings.Development.json`

## 3. Uruchom aplikacje

1. Uruchom: `1-URUCHOM-API.bat`
2. Uruchom: `2-URUCHOM-FRONT.bat`
3. Otworz: **https://localhost:4200**

Przy pierwszym starcie backend sam utworzy tabele `cars` i doda auta testowe.

## Jak korzystac

1. Kliknij **ZABIERZ AUTO** albo **ODDAJ AUTO**
2. Zeskanuj kod QR lub wpisz go recznie
3. Potwierdz operacje

## Kody testowe

- `QR001`
- `QR002`
- `QR003`
- `QR004`
- `QR005`

## Gdy nie dziala

- Jesli blad polaczenia z baza: sprawdz haslo w `appsettings.json`.
- Jesli baza nie istnieje: utworz `system_kluczykowy` w pgAdmin.
- Jesli widzisz `localhost:5000` / `5296` w przegladarce: to samo API.
  Strona jest na **https://localhost:4200**.

## Wdrozenie na serwer (wazne — logowanie)

Lokalnie (VS F5) dzialaja **dwa procesy**: Angular na `:4200` + API na `:5296` (proxy).
Na serwerze **nie uruchamiaj `npm start`** — to tylko tryb developerski.

### Poprawny sposob na serwerze

1. Sklonuj repo i wejdz do folderu projektu.
2. Zbuduj i opublikuj **jedna aplikacje** (Angular + API razem):

```bash
cd AngularApp1.Server
dotnet publish -c Release -o ./publish
```

3. Na serwerze ustaw PostgreSQL w `publish/appsettings.Production.json`:
   - host, port, baze `system_kluczykowy`, login i haslo postgres
4. Uruchom:

```bash
cd publish
set ASPNETCORE_ENVIRONMENT=Production
dotnet AngularApp1.Server.dll --urls "http://0.0.0.0:5000"
```

5. W przegladarce wejdz na **ten sam adres co API**, np. `http://IP_SERWERA:5000/login`.
   Nie uzywaj portu `:4200` na serwerze.

### Konta testowe (logowanie)

| Login | Haslo | Rola |
|-------|-------|------|
| `admin` | `admin123` | Admin → `/admin` |
| `pracownik` | `pracownik123` | Pracownik → `/panel` |

### Jesli logowanie nie dziala — szybka diagnostyka

1. Otworz w przegladarce: `http://ADRES_SERWERA:PORT/api/cars`  
   - **401 Unauthorized** = API dziala (to OK przed logowaniem)  
   - **404 / strona HTML** = API nie dziala albo zly adres  
   - **brak polaczenia** = backend nie jest uruchomiony
2. Sprawdz logi startu backendu — jesli blad PostgreSQL, aplikacja moze w ogole nie wstac.
3. Upewnij sie, ze kolega zrobil `dotnet publish`, a nie tylko `git pull` + `dotnet run` bez buildu Angulara.
4. Na serwerze bez HTTPS ustaw w `appsettings.Production.json`: `"UseHttpsRedirection": false`.

## Visual Studio (opcjonalnie)

1. Otworz `AngularApp1.slnx`
2. Startowy projekt: `AngularApp1.Server`
3. Profil: `https`
4. F5

## Telefon w tej samej sieci Wi-Fi (LAN)

Wszyscy w tej samej sieci korzystaja z **jednej bazy PostgreSQL** na komputerze z uruchomionym VS (F5).

1. Na PC sprawdz IP: `ipconfig` → np. `192.168.1.168`
2. Na telefonie (to samo Wi-Fi): `https://TWOJE_IP:4200`
3. Zaakceptuj certyfikat developerski w przegladarce
4. Panel admina odswieza liste **automatycznie co 3 sekundy**

Konto admin: `admin` / `admin123` → `/admin`  
Konto pracownik: `pracownik` / `pracownik123` → skaner QR

> Aplikacja nasluchuje na calej sieci lokalnej (`0.0.0.0`). Nie wystawiaj portu na routerze —
> wtedy dostep bedzie tylko z Waszej sieci Wi-Fi.
