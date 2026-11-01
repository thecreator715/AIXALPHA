@echo off
REM AIX ALPHA master node (Windows). Closes old connections, verifies the key, starts the server, opens the app.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node 20+ is required: https://nodejs.org & exit /b 1)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%P >nul 2>nul
taskkill /F /IM cloudflared.exe >nul 2>nul
if not exist .env.local (
  set /p KEY=Paste your Anthropic API key (sk-ant-...): 
  for /f %%A in ('node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"') do set ADMIN=%%A
  > .env.local echo ANTHROPIC_API_KEY="%KEY%"
  >> .env.local echo AIX_ADMIN_TOKEN="%ADMIN%"
  >> .env.local echo AIX_ALLOWED_ORIGINS="*"
  >> .env.local echo AIX_SIGNUP_CREDITS=0
  >> .env.local echo AIX_DATA_DIR="data"
  >> .env.local echo PORT=3000
)
if not exist node_modules call npm install --no-audit --no-fund
set NODE_ENV=production
if /i "%1"=="public" (where cloudflared >nul 2>nul && start "AIX tunnel" cloudflared tunnel --url http://localhost:3000)
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000/alpha"
call npx tsx server.ts
