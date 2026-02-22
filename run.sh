#!/usr/bin/env bash
# ============================================================
#  OpenStreamRotatorWeb — Run
#  Starts both the backend and frontend.
#  Backend runs in the background, frontend in the foreground.
#  Press Ctrl+C to stop both.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo " =========================================="
echo "  OpenStreamRotatorWeb - Starting Services"
echo " =========================================="
echo ""

# ----------------------------------------------------------
# Pre-flight checks
# ----------------------------------------------------------
if [ ! -f "backend/.env" ]; then
    echo " ERROR: backend/.env not found."
    echo " Run ./setup.sh first to configure the dashboard."
    echo ""
    exit 1
fi

if [ ! -d "backend/.venv" ]; then
    echo " ERROR: backend virtual environment not found."
    echo " Run ./setup.sh first, or manually create it:"
    echo "   cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    echo ""
    exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
    echo " ERROR: frontend/node_modules not found."
    echo " Run ./setup.sh first, or manually install:"
    echo "   cd frontend && npm install"
    echo ""
    exit 1
fi

# ----------------------------------------------------------
# Cleanup on exit — kill backend when frontend stops
# ----------------------------------------------------------
BACKEND_PID=""
cleanup() {
    echo ""
    echo " Shutting down..."
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null
        wait "$BACKEND_PID" 2>/dev/null
    fi
    echo " All services stopped."
}
trap cleanup EXIT INT TERM

# ----------------------------------------------------------
# Run migrations
# ----------------------------------------------------------
echo " Running database migrations..."
cd backend
source .venv/bin/activate
python -m alembic upgrade head 2>&1 | tail -1
echo ""

# ----------------------------------------------------------
# Start backend in background
# ----------------------------------------------------------
echo " Starting backend on http://localhost:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Give the backend a moment to start
sleep 2

# ----------------------------------------------------------
# Start frontend in foreground
# ----------------------------------------------------------
echo " Starting frontend on http://localhost:3000..."
echo ""
echo " Press Ctrl+C to stop both services."
echo ""
cd frontend
npm run dev
