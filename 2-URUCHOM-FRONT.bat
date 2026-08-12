@echo off
title System kluczykowy - Frontend
cd /d "%~dp0angularapp1.client"
echo.
echo === FRONTEND ===
echo Po starcie wejdz w przegladarke na:
echo https://localhost:4200
echo.
echo NIE zamykaj tego okna!
echo.
call npm install
call npm start
pause
