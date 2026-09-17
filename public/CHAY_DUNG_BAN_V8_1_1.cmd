@echo off
chcp 65001 >nul
cd /d "%~dp0"
title BEEN MEDIA ERP V8.1.1 - PORT 3010
cls
echo ======================================================
echo        BEEN MEDIA ERP V8.1.1 - BAN MOI THAT
echo ======================================================
echo.
echo Ban nay CHAY RIENG tren: http://localhost:3010
echo Neu trang 3000 dang mo, DO LA BAN CU. Khong dung trang 3000.
echo.
if not exist ".env.local" (
  echo [CANH BAO] Chua co .env.local
  echo Hay copy .env.local tu project cu vao thu muc nay.
  echo Sau do bam phim bat ky de tiep tuc.
  pause >nul
)
if not exist "node_modules\next\dist\bin\next" (
  echo Dang cai thu vien npm. Lan dau co the mat vai phut...
  call npm install
  if errorlevel 1 (
    echo.
    echo CAI THU VIEN THAT BAI. Gui anh man hinh nay cho ChatGPT.
    pause
    exit /b 1
  )
)
if exist ".next" rmdir /s /q ".next"
echo.
echo Dang mo BEEN MEDIA ERP V8.1.1 tai cong 3010...
echo Sau khi thay Ready, mo: http://localhost:3010
echo.
start "" "http://localhost:3010"
call npm run dev -- -p 3010
pause
