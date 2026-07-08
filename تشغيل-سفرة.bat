@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo    Sufrah - starting local server...
echo ============================================
start "Sufrah Server" powershell -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0serve.ps1"
timeout /t 2 >nul
start "" "http://localhost:4173/"
echo.
echo  Sufrah is now open in your browser:
echo    http://localhost:4173/
echo.
echo  Keep the minimized server window running while you use the site.
echo  Close it to stop the server.
echo.
pause
