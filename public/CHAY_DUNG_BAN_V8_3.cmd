@echo off
setlocal
cd /d "%~dp0"
title BEEN MEDIA ERP V8.3
cls
echo ==============================================
echo      BEEN MEDIA ERP V8.3 - DUNG BAN MOI
echo ==============================================
echo.
echo Dia chi: http://localhost:3010
echo.
if not exist node_modules (
  echo Dang cai thu vien lan dau, vui long doi...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
start "" http://localhost:3010
call npm run dev -- -p 3010
pause
