@echo off
REM AIX ALPHA master node: runs the server on this machine. Windows.
REM   start-master.bat            local only -> http://localhost:3000/alpha
REM   start-master.bat public     also opens a free public https tunnel (needs cloudflared)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node 20+ is required: https://nodejs.org & exit /b 1)
if not exist .env.local (
  set /p KEY=Paste your Anthropic API key (sk-ant-...): 
  for /f %%A in ('node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"') do set ADMIN=%%A
  > .env.local echo ANTHROPIC_API_KEY="%KEY%"
  >> .env.local echo AIX_ADMIN_TOKEN="%ADMIN%"
  >> .env.local echo AIX_ALLOWED_ORIGINS="*"
  >> .env.local echo AIX_SIGNUP_CREDITS=0
  >> .env.local echo AIX_DATA_DIR="data"
  >> .env.local echo PORT=3000
  echo Saved .env.local. Your admin token: %ADMIN%
)
if not exist node_modules call npm install --no-audit --no-fund
set NODE_ENV=production
if /i "%1"=="public" (
  where cloudflared >nul 2>nul && start "AIX tunnel" cloudflared tunnel --url http://localhost:3000 || echo cloudflared not found - install it for a public URL
)
echo AIX ALPHA master node starting on http://localhost:3000/alpha
call npx tsx server.ts
