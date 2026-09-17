@echo off
cd /d "%~dp0"
echo ========================================
echo BEEN MEDIA ERP V8.3.6
echo ========================================
if not exist .env.local (
  echo CHUA CO .env.local - hay copy tu ban cu sang thu muc nay.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto :err
call npm run dev
exit /b
:err
echo Co loi khi cai thu vien. Chup man hinh gui ChatGPT.
pause
