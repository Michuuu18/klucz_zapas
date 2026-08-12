@echo off
title System kluczykowy - API
cd /d "%~dp0AngularApp1.Server"
echo.
echo === BACKEND API ===
echo Adres API: http://localhost:5296
echo.
echo NIE zamykaj tego okna!
echo.
dotnet run --launch-profile api
pause
