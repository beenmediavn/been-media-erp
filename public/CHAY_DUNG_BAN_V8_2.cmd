@echo off
chcp 65001 >nul
cd /d "%~dp0"
title BEEN MEDIA ERP V8.2 - PORT 3010

echo ==============================================
echo   BEEN MEDIA ERP V8.2
echo   CHAM CONG CAMERA + SUA NO + XOA CHAT
echo ==============================================
echo.
if not exist .env.local (
  echo [CANH BAO] Chua co .env.local
  echo Hay copy .env.local tu project cu sang thu muc nay.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dang cai thu vien...
  call npm install
  if errorlevel 1 pause
)
echo.
echo Mo dung ban moi tai: http://localhost:3010
echo.
start "" http://localhost:3010
call npm run dev -- -p 3010
pause
