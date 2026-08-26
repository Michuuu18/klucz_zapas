# System kluczykowy - REKORD

Aplikacja do ewidencji kluczy samochodowych firmy **REKORD Systemy Informatyczne** (Bielsko-Biała).

Umożliwia zabieranie i oddawanie kluczy (skan QR lub wpis ręczny), śledzenie statusu floty oraz kompleksowe zarządzanie rejestrami przez administratora. 
System pozwala dodatkowo na dodawanie notatek do wypożyczeń, oznaczanie kluczy jako zagubione lub odnalezione, 
a także dodawanie nowych kluczy, edycję tablic rejestracyjnych oraz generowanie kodów QR.

**Stack:** Angular (TypeScript, SCSS, HTML) • ASP.NET Core (C#) • PostgreSQL

---

## Podgląd

### Logowanie

![Logowanie](docs/screenshots/01-logowanie.png)

### Panel administratora

![Panel administratora - tryb ciemny](docs/screenshots/02-panel-admin-ciemny.png)

![Panel administratora - tryb jasny](docs/screenshots/03-panel-admin-jasny.png)

### Historia kluczy

![Historia kluczy](docs/screenshots/09-historia-kluczy.png)

### Dodawanie klucza

![Dodaj nowy klucz](docs/screenshots/04-dodaj-klucz.png)

### Edycja tablic

![Edycja tablic](docs/screenshots/11-edycja-tablic.png)

### Generowanie kodów QR

![Generuj kod QR](docs/screenshots/05-generuj-qr.png)

### Zapisywanie kodów QR

![Zapisywanie kodów QR](docs/screenshots/07-Zapisywanie-kodów-qr.png)

### Notatki

![Notatki](docs/screenshots/10-notatki.png)

### Skaner (pracownik)

![Skaner QR](docs/screenshots/06-skaner-qr.png)





---

## Funkcje

- **Role:** Admin (`/admin`) i Pracownik (`/panel`)
- **Statusy kluczy:** Wolne · W użyciu · Zagubione
- **Rodzaje kluczy:** oryginalny, zapasowy albo oba naraz
- **Kody QR:** etykiety do druku (pojedynczo lub ZIP dla całej floty)
- **Historia:** kto zabrał / zwrócił klucz (ostatnie 30 dni)
- **Filtry:** marka oraz rodzaj klucza (oryginalny / zapasowy)
- **Motyw:** jasny i ciemny

---

## Konta testowe

| Login | Hasło | Rola |
| :--- | :--- | :--- |
| `admin` | `admin123` | Administrator |
| `pracownik` | `pracownik123` | Pracownik |
| `dominik` | `dominik123` | Pracownik |
| `michal` | `michal123` | Pracownik |
| `agnieszka` | `agnieszka123` | Pracownik |

---

## Uruchomienie lokalne

### 1. Baza PostgreSQL

W pgAdmin utwórz bazę: `system_kluczykowy`.

W plikach:

- `AngularApp1.Server/appsettings.json`
- `AngularApp1.Server/appsettings.Development.json`

ustaw hasło użytkownika `postgres`:

```
Password=TWOJE_HASLO
```

### 2. Start aplikacji

1. Uruchom `1-URUCHOM-API.bat`
2. Uruchom `2-URUCHOM-FRONT.bat`
3. Otwórz **https://localhost:4200**

Przy pierwszym starcie API samo utworzy tabele i doda przykładowe auta.

### Visual Studio (opcjonalnie)

1. Otwórz `AngularApp1.slnx`
2. Projekt startowy: `AngularApp1.Server`
3. Profil `https` → F5

---

## Jak korzystać

**Pracownik**

1. Zaloguj się
2. Wybierz **Zabierz** albo **Oddaj**
3. Zeskanuj kod QR od razu za pomocą aparatu w urządzeniu (np. w telefonie) albo wpisz go ręcznie
4. Potwierdź operację

**Administrator**

- przegląda rejestr i statusy floty
- dodaje / edytuje klucze
- generuje etykiety QR (także ZIP dla wszystkich aut)
- oznacza klucze jako zagubione / znalezione
- sprawdza historię wypożyczeń

---

## Format kodu QR

Kod ma postać: **slot + 2 ostatnie litery/cyfry rejestracji**  
Przykład: tablice `SB 895C`, slot `15` → `155C`

Numery wewnętrzne kluczy: `K-O-XX` (oryginalny), `K-Z-XX` (zapasowy).

---

## Telefon w sieci Wi-Fi

1. Na PC: `ipconfig` → zapisz adres IP
2. Na telefonie (to samo Wi-Fi): `https://TWOJE_IP:4200`
3. Zaakceptuj certyfikat developerski w przeglądarce

---

## Wdrożenie na serwer

Na serwerze **nie** uruchamiaj `npm start` — to tryb developerski.

```bash
cd AngularApp1.Server
dotnet publish -c Release -o ./publish
```

Ustaw połączenie z PostgreSQL w `publish/appsettings.Production.json`, potem:

```bash
cd publish
set ASPNETCORE_ENVIRONMENT=Production
dotnet AngularApp1.Server.dll --urls "http://0.0.0.0:5000"
```

Wejdź na adres API, np. `http://IP_SERWERA:5000/login`.

Bez HTTPS dodaj w produkcji: `"UseHttpsRedirection": false`.

---

## Gdy coś nie działa

- **Błąd bazy** — sprawdź hasło i czy istnieje baza `system_kluczykowy`
- **Logowanie nie działa** — otwórz `/api/cars` (401 = API działa; 404 = zły adres)
- **Strona lokalnie** — zawsze **https://localhost:4200**, nie port API
