Ten plik wyjaśnia, jak Visual Studio utworzyło projekt.

Następujące narzędzia zostały użyte do wygenerowania tego projektu:
- Angular CLI (ng)

Następujące kroki zostały użyte do wygenerowania tego projektu:
- Tworzenie projektu Angular za pomocą narzędzia NG: `ng new angularapp1.client --defaults --skip-install --skip-git --no-standalone `.
- Dodaj `proxy.conf.js` do wywołań serwera proxy do serwera ASP.NET zaplecza.
- Dodaj skrypt `aspnetcore-https.js`, aby zainstalować certyfikaty HTTPS.
- Zaktualizuj `package.json`, aby wywoływać `aspnetcore-https.js` i obsługiwać za pomocą protokołu HTTPS.
- Zaktualizuj `angular.json`, aby wskazać `proxy.conf.js`.
- Zaktualizuj składnik app.ts, aby pobrać i wyświetlić informacje o pogodzie.
- Modyfikuj app.spec.ts przy użyciu zaktualizowanych testów.
- Zaktualizuj app-module.ts, aby zaimportować moduł HttpClientModule.
- Utwórz plik projektu (`angularapp1.client.esproj`).
- Utwórz `launch.json`, aby włączyć debugowanie.
- Zaktualizuj package.json, aby dodać `jest-editor-support`.
- Zaktualizuj package.json, aby dodać `run-script-os`.
- Dodaj `karma.conf.js` dla testów jednostkowych.
- Zaktualizuj `angular.json`, aby wskazać `karma.conf.js`.
- Dodaj projekt do rozwiązania.
- Zaktualizuj punkt końcowy serwera proxy, aby był punktem końcowym serwera zaplecza.
- Dodaj projekt do listy projektów startowych.
- Zapisz ten plik.
