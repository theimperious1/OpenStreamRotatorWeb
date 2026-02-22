@echo off
setlocal enabledelayedexpansion

:: ============================================================
::  OpenStreamRotatorWeb — Interactive Setup
::  Walks you through configuring your backend .env file.
::  Nothing is saved until you confirm at the end.
:: ============================================================

echo.
echo  ==========================================
echo   OpenStreamRotatorWeb - Interactive Setup
echo  ==========================================
echo.

:: ----------------------------------------------------------
:: Check if .env already exists
:: ----------------------------------------------------------
if not exist "backend\.env" goto :INIT_DEFAULTS

echo  A backend\.env file already exists.
set /p OVERWRITE="  Overwrite it? Existing values will be lost. [y/N]: "
if /i "!OVERWRITE!"=="y" goto :INIT_DEFAULTS
echo.
echo  Setup cancelled. Your existing .env was not modified.
echo.
pause
exit /b 0

:: ----------------------------------------------------------
:: Defaults
:: ----------------------------------------------------------
:INIT_DEFAULTS
echo.

set "VAL_DISCORD_CLIENT_ID="
set "VAL_DISCORD_CLIENT_SECRET="
set "VAL_DISCORD_REDIRECT_URI=http://localhost:8000/auth/discord/callback"

set "VAL_JWT_SECRET=AUTO"
set "VAL_JWT_ALGORITHM=HS256"
set "VAL_JWT_EXPIRY_HOURS=72"

set "VAL_DATABASE_URL=sqlite+aiosqlite:///./osr_web.db"

set "VAL_FRONTEND_URL=http://localhost:3000"
set "VAL_ALLOWED_ORIGINS="

set "VAL_SMTP_HOST="
set "VAL_SMTP_PORT=587"
set "VAL_SMTP_USER="
set "VAL_SMTP_PASSWORD="
set "VAL_SMTP_FROM="
set "VAL_BUG_REPORT_TO="

:: ===========================================================
::  1. Discord OAuth (required)
:: ===========================================================
echo  --- Discord OAuth (required) ---
echo.
echo  The dashboard uses Discord for login. You need a Discord application.
echo.
echo  To create one:
echo    1. Go to https://discord.com/developers/applications
echo    2. Click "New Application" and give it a name
echo    3. Go to OAuth2 in the left sidebar
echo    4. Copy the Client ID and Client Secret
echo    5. Add a redirect URL: http://localhost:8000/auth/discord/callback
echo       For production, use your domain instead of localhost.
echo.
set /p VAL_DISCORD_CLIENT_ID="  Discord Client ID: "
set /p VAL_DISCORD_CLIENT_SECRET="  Discord Client Secret: "
echo.
set /p INPUT="  Discord Redirect URI [http://localhost:8000/auth/discord/callback]: "
if not "!INPUT!"=="" set "VAL_DISCORD_REDIRECT_URI=!INPUT!"

:: Strip trailing slash
if "!VAL_DISCORD_REDIRECT_URI:~-1!"=="/" set "VAL_DISCORD_REDIRECT_URI=!VAL_DISCORD_REDIRECT_URI:~0,-1!"
echo.

:: ===========================================================
::  2. Database
:: ===========================================================
echo  --- Database ---
echo.
echo  OSR Web supports SQLite (default, zero config) or PostgreSQL.
echo  SQLite is fine for personal use. Use Postgres for production or Docker.
echo  If you don't know what PostgreSQL is, just press Enter or type N.
echo.
set /p WANT_POSTGRES="  Use PostgreSQL instead of SQLite? [y/N]: "
if /i not "!WANT_POSTGRES!"=="y" goto :SKIP_POSTGRES

echo.
echo  Prerequisites:
echo    - PostgreSQL must be installed and running
echo    - The target database must already exist
echo    - Create it with: CREATE DATABASE osr_web;  (in psql)
echo.
echo  Connection string format:
echo    postgresql+asyncpg://user:password@host:5432/dbname
echo.
set /p VAL_DATABASE_URL="  Database URL: "
echo.

:SKIP_POSTGRES
echo.

:: ===========================================================
::  3. Frontend URL
:: ===========================================================
echo  --- Frontend URL ---
echo.
echo  The URL where the frontend will be accessible.
echo  For local development this is http://localhost:3000.
echo.
set /p INPUT="  Frontend URL [http://localhost:3000]: "
if not "!INPUT!"=="" set "VAL_FRONTEND_URL=!INPUT!"

:: Strip trailing slash to avoid CORS mismatch
if "!VAL_FRONTEND_URL:~-1!"=="/" set "VAL_FRONTEND_URL=!VAL_FRONTEND_URL:~0,-1!"
echo.

:: If they changed the frontend URL, set CORS automatically
if not "!VAL_FRONTEND_URL!"=="http://localhost:3000" set "VAL_ALLOWED_ORIGINS=!VAL_FRONTEND_URL!"

:: ===========================================================
::  4. SMTP (optional)
:: ===========================================================
echo  --- Email / SMTP ---
echo.
set /p WANT_SMTP="  Do you have SMTP credentials for sending emails? [y/N]: "
if /i "!WANT_SMTP!"=="y" goto :ASK_SMTP
goto :EXPLAIN_SMTP

:ASK_SMTP
set /p VAL_SMTP_HOST="  SMTP host [smtp.gmail.com]: "
if "!VAL_SMTP_HOST!"=="" set "VAL_SMTP_HOST=smtp.gmail.com"
set /p INPUT="  SMTP port [587]: "
if not "!INPUT!"=="" set "VAL_SMTP_PORT=!INPUT!"
set /p VAL_SMTP_USER="  SMTP username (email): "
set /p VAL_SMTP_PASSWORD="  SMTP password (app password for Gmail): "
set /p VAL_SMTP_FROM="  Send-from email address: "
echo.
set /p INPUT="  Bug report recipient [leave blank for OSR developer]: "
if not "!INPUT!"=="" set "VAL_BUG_REPORT_TO=!INPUT!"
echo.
goto :DONE_SMTP

:EXPLAIN_SMTP
echo.
echo  SMTP is used to send bug report emails from the dashboard.
echo  It's completely optional. If you use Gmail, you'll need an App Password.
echo  Learn more: https://support.google.com/accounts/answer/185833
echo.
set /p WANT_SMTP2="  Would you like to set it up? [y/N]: "
if /i not "!WANT_SMTP2!"=="y" goto :DONE_SMTP
echo.
set /p VAL_SMTP_HOST="  SMTP host [smtp.gmail.com]: "
if "!VAL_SMTP_HOST!"=="" set "VAL_SMTP_HOST=smtp.gmail.com"
set /p INPUT="  SMTP port [587]: "
if not "!INPUT!"=="" set "VAL_SMTP_PORT=!INPUT!"
set /p VAL_SMTP_USER="  SMTP username (email): "
set /p VAL_SMTP_PASSWORD="  SMTP password (app password for Gmail): "
set /p VAL_SMTP_FROM="  Send-from email address: "
echo.
set /p INPUT="  Bug report recipient [leave blank for OSR developer]: "
if not "!INPUT!"=="" set "VAL_BUG_REPORT_TO=!INPUT!"
echo.

:DONE_SMTP
echo.

:: ===========================================================
::  Summary
:: ===========================================================
echo.
echo  ==========================================
echo   Configuration Summary
echo  ==========================================
echo.
echo  Discord Client ID:   !VAL_DISCORD_CLIENT_ID!
echo  Discord Redirect:    !VAL_DISCORD_REDIRECT_URI!
echo  JWT Secret:          auto-generated on first start
echo  Database:            !VAL_DATABASE_URL!
echo  Frontend URL:        !VAL_FRONTEND_URL!
if not "!VAL_ALLOWED_ORIGINS!"=="" echo  CORS Origins:        !VAL_ALLOWED_ORIGINS!
if not "!VAL_SMTP_HOST!"=="" echo  SMTP:                !VAL_SMTP_HOST!:!VAL_SMTP_PORT!
echo.

set /p CONFIRM="  Save this configuration to backend\.env? [Y/n]: "
if /i "!CONFIRM!"=="n" goto :CANCELLED

:: ===========================================================
::  Write backend\.env
:: ===========================================================
> backend\.env echo # Discord OAuth
>> backend\.env echo DISCORD_CLIENT_ID=!VAL_DISCORD_CLIENT_ID!
>> backend\.env echo DISCORD_CLIENT_SECRET=!VAL_DISCORD_CLIENT_SECRET!
>> backend\.env echo DISCORD_REDIRECT_URI=!VAL_DISCORD_REDIRECT_URI!
>> backend\.env echo.
>> backend\.env echo # JWT - auto-generated on first start if left as default
>> backend\.env echo JWT_SECRET=change-me-to-a-random-secret
>> backend\.env echo JWT_ALGORITHM=!VAL_JWT_ALGORITHM!
>> backend\.env echo JWT_EXPIRY_HOURS=!VAL_JWT_EXPIRY_HOURS!
>> backend\.env echo.
>> backend\.env echo # Database
>> backend\.env echo DATABASE_URL=!VAL_DATABASE_URL!
>> backend\.env echo.
>> backend\.env echo # Frontend
>> backend\.env echo FRONTEND_URL=!VAL_FRONTEND_URL!
>> backend\.env echo.
>> backend\.env echo # CORS
if not "!VAL_ALLOWED_ORIGINS!"=="" >> backend\.env echo ALLOWED_ORIGINS=!VAL_ALLOWED_ORIGINS!
>> backend\.env echo.
>> backend\.env echo # SMTP
>> backend\.env echo SMTP_HOST=!VAL_SMTP_HOST!
>> backend\.env echo SMTP_PORT=!VAL_SMTP_PORT!
>> backend\.env echo SMTP_USER=!VAL_SMTP_USER!
>> backend\.env echo SMTP_PASSWORD=!VAL_SMTP_PASSWORD!
>> backend\.env echo SMTP_FROM=!VAL_SMTP_FROM!
>> backend\.env echo BUG_REPORT_TO=!VAL_BUG_REPORT_TO!

echo.
echo  backend\.env saved successfully!
echo.

:: ===========================================================
::  Install dependencies and run migrations
:: ===========================================================
set /p INSTALL="  Install dependencies and run database migrations now? [Y/n]: "
if /i "!INSTALL!"=="n" goto :SKIP_INSTALL

echo.
echo  Installing backend dependencies...
cd backend
if not exist ".venv" (
    python -m venv .venv
    echo  Created virtual environment.
)
call .venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
echo.
echo  Running database migrations...
python -m alembic upgrade head
echo.
cd ..

echo  Checking frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo  Installing frontend packages...
    call npm install
) else (
    echo  node_modules already exists, skipping npm install.
)
cd ..
echo.
goto :FINISHED

:SKIP_INSTALL
echo.
echo  Skipped dependency installation.
echo  Before running, make sure to:
echo    1. cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -r requirements.txt
echo    2. python -m alembic upgrade head
echo    3. cd ..\frontend ^&^& npm install
echo.

:FINISHED
echo.
echo  Setup complete!
echo  Run run.bat to start the dashboard.
echo.
pause
exit /b 0

:CANCELLED
echo.
echo  Setup cancelled. Nothing was saved.
echo.
pause
exit /b 0
