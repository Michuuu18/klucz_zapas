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

## Visual Studio (opcjonalnie)

1. Otworz `AngularApp1.slnx`
2. Startowy projekt: `AngularApp1.Server`
3. Profil: `https`
4. F5
