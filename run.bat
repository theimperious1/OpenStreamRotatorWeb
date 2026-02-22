@echo off
:: ============================================================
::  OpenStreamRotatorWeb — Run
::  Starts both the backend and frontend in separate windows.
:: ============================================================

echo.
echo  ==========================================
echo   OpenStreamRotatorWeb - Starting Services
echo  ==========================================
echo.

:: ----------------------------------------------------------
:: Pre-flight checks
:: ----------------------------------------------------------
if not exist "backend\.env" (
    echo  ERROR: backend\.env not found.
    echo  Run setup.bat first to configure the dashboard.
    echo.
    pause
    exit /b 1
)

if not exist "backend\.venv\Scripts\activate.bat" (
    echo  ERROR: backend virtual environment not found.
    echo  Run setup.bat first, or manually create it:
    echo    cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo  ERROR: frontend\node_modules not found.
    echo  Run setup.bat first, or manually install:
    echo    cd frontend ^&^& npm install
    echo.
    pause
    exit /b 1
)

:: ----------------------------------------------------------
:: Start backend in a new window
:: ----------------------------------------------------------
echo  Starting backend...
start "OSR Web - Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate.bat && python -m alembic upgrade head && echo. && echo  Backend starting on http://localhost:8000 && echo. && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Give the backend a moment to start before the frontend
timeout /t 2 /nobreak > nul

:: ----------------------------------------------------------
:: Start frontend in a new window
:: ----------------------------------------------------------
echo  Starting frontend...
start "OSR Web - Frontend" cmd /k "cd /d %~dp0frontend && echo  Frontend starting on http://localhost:3000 && echo. && npm run dev"

echo.
echo  Both services are starting in separate windows:
echo    Backend:  http://localhost:8000
echo    Frontend: http://localhost:3000
echo.
echo  Close the terminal windows to stop the services.
echo.
pause
