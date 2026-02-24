@echo off
echo Stopping backend server...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *UNIXA_ADMIN_PANEL_BACKEND*" 2>nul
timeout /t 2 /nobreak >nul
echo Starting backend server...
cd /d "%~dp0"
start "UNIXA Backend Server" cmd /k npm run dev
echo Backend server restarted!
pause
