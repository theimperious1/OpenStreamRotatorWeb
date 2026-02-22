#!/usr/bin/env bash
# ============================================================
#  OpenStreamRotatorWeb — Interactive Setup
#  Walks you through configuring your backend .env file.
#  Nothing is saved until you confirm at the end.
# ============================================================

set -e

echo ""
echo " =========================================="
echo "  OpenStreamRotatorWeb - Interactive Setup"
echo " =========================================="
echo ""

# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------
ask() {
    local prompt="$1"
    local default="$2"
    local result
    if [ -n "$default" ]; then
        read -rp "  $prompt [$default]: " result
        echo "${result:-$default}"
    else
        read -rp "  $prompt: " result
        echo "$result"
    fi
}

ask_yn() {
    local prompt="$1"
    local default="${2:-n}"
    local result
    if [ "$default" = "y" ]; then
        read -rp "  $prompt [Y/n]: " result
        result="${result:-y}"
    else
        read -rp "  $prompt [y/N]: " result
        result="${result:-n}"
    fi
    [[ "$result" =~ ^[Yy]$ ]]
}

# ----------------------------------------------------------
# Check if .env already exists
# ----------------------------------------------------------
if [ -f "backend/.env" ]; then
    echo " A backend/.env file already exists."
    if ! ask_yn "Overwrite it? Existing values will be lost."; then
        echo ""
        echo " Setup cancelled. Your existing .env was not modified."
        echo ""
        exit 0
    fi
    echo ""
fi

# ----------------------------------------------------------
# Defaults
# ----------------------------------------------------------
VAL_DISCORD_CLIENT_ID=""
VAL_DISCORD_CLIENT_SECRET=""
VAL_DISCORD_REDIRECT_URI="http://localhost:8000/auth/discord/callback"

VAL_JWT_ALGORITHM="HS256"
VAL_JWT_EXPIRY_HOURS="72"

VAL_DATABASE_URL="sqlite+aiosqlite:///./osr_web.db"

VAL_FRONTEND_URL="http://localhost:3000"
VAL_ALLOWED_ORIGINS=""

VAL_SMTP_HOST=""
VAL_SMTP_PORT="587"
VAL_SMTP_USER=""
VAL_SMTP_PASSWORD=""
VAL_SMTP_FROM=""
VAL_BUG_REPORT_TO=""

# ===========================================================
#  1. Discord OAuth (required)
# ===========================================================
echo " --- Discord OAuth (required) ---"
echo ""
echo " The dashboard uses Discord for login. You need a Discord application."
echo ""
echo " To create one:"
echo "   1. Go to https://discord.com/developers/applications"
echo "   2. Click \"New Application\" and give it a name"
echo "   3. Go to OAuth2 in the left sidebar"
echo "   4. Copy the Client ID and Client Secret"
echo "   5. Add a redirect URL: http://localhost:8000/auth/discord/callback"
echo "      For production, use your domain instead of localhost."
echo ""
VAL_DISCORD_CLIENT_ID=$(ask "Discord Client ID")
VAL_DISCORD_CLIENT_SECRET=$(ask "Discord Client Secret")
echo ""
input=$(ask "Discord Redirect URI" "http://localhost:8000/auth/discord/callback")
VAL_DISCORD_REDIRECT_URI="${input%/}"  # strip trailing slash
echo ""

# ===========================================================
#  2. Database
# ===========================================================
echo " --- Database ---"
echo ""
echo " OSR Web supports SQLite (default, zero config) or PostgreSQL."
echo " SQLite is fine for personal use. Use Postgres for production or Docker."
echo " If you don't know what PostgreSQL is, just press Enter or type N."
echo ""
if ask_yn "Use PostgreSQL instead of SQLite?"; then
    echo ""
    echo " Prerequisites:"
    echo "   - PostgreSQL must be installed and running"
    echo "   - The target database must already exist"
    echo "   - Create it with: CREATE DATABASE osr_web;  (in psql)"
    echo ""
    echo " Connection string format:"
    echo "   postgresql+asyncpg://user:password@host:5432/dbname"
    echo ""
    VAL_DATABASE_URL=$(ask "Database URL")
    echo ""
fi
echo ""

# ===========================================================
#  3. Frontend URL
# ===========================================================
echo " --- Frontend URL ---"
echo ""
echo " The URL where the frontend will be accessible."
echo " For local development this is http://localhost:3000."
echo ""
input=$(ask "Frontend URL" "http://localhost:3000")
VAL_FRONTEND_URL="${input%/}"  # strip trailing slash to avoid CORS mismatch
echo ""

# If they changed the frontend URL, set CORS automatically
if [ "$VAL_FRONTEND_URL" != "http://localhost:3000" ]; then
    VAL_ALLOWED_ORIGINS="$VAL_FRONTEND_URL"
fi

# ===========================================================
#  4. SMTP (optional)
# ===========================================================
echo " --- Email / SMTP ---"
echo ""
if ask_yn "Do you have SMTP credentials for sending emails?"; then
    VAL_SMTP_HOST=$(ask "SMTP host" "smtp.gmail.com")
    input=$(ask "SMTP port" "587")
    VAL_SMTP_PORT="$input"
    VAL_SMTP_USER=$(ask "SMTP username (email)")
    VAL_SMTP_PASSWORD=$(ask "SMTP password (app password for Gmail)")
    VAL_SMTP_FROM=$(ask "Send-from email address")
    echo ""
    input=$(ask "Bug report recipient (leave blank for OSR developer)")
    [ -n "$input" ] && VAL_BUG_REPORT_TO="$input"
    echo ""
else
    echo ""
    echo " SMTP is used to send bug report emails from the dashboard."
    echo " It's completely optional. If you use Gmail, you'll need an App Password."
    echo " Learn more: https://support.google.com/accounts/answer/185833"
    echo ""
    if ask_yn "Would you like to set it up?"; then
        echo ""
        VAL_SMTP_HOST=$(ask "SMTP host" "smtp.gmail.com")
        input=$(ask "SMTP port" "587")
        VAL_SMTP_PORT="$input"
        VAL_SMTP_USER=$(ask "SMTP username (email)")
        VAL_SMTP_PASSWORD=$(ask "SMTP password (app password for Gmail)")
        VAL_SMTP_FROM=$(ask "Send-from email address")
        echo ""
        input=$(ask "Bug report recipient (leave blank for OSR developer)")
        [ -n "$input" ] && VAL_BUG_REPORT_TO="$input"
        echo ""
    fi
fi
echo ""

# ===========================================================
#  Summary
# ===========================================================
echo ""
echo " =========================================="
echo "  Configuration Summary"
echo " =========================================="
echo ""
echo " Discord Client ID:   $VAL_DISCORD_CLIENT_ID"
echo " Discord Redirect:    $VAL_DISCORD_REDIRECT_URI"
echo " JWT Secret:          auto-generated on first start"
echo " Database:            $VAL_DATABASE_URL"
echo " Frontend URL:        $VAL_FRONTEND_URL"
[ -n "$VAL_ALLOWED_ORIGINS" ] && echo " CORS Origins:        $VAL_ALLOWED_ORIGINS"
[ -n "$VAL_SMTP_HOST" ] && echo " SMTP:                $VAL_SMTP_HOST:$VAL_SMTP_PORT"
echo ""

if ! ask_yn "Save this configuration to backend/.env?" "y"; then
    echo ""
    echo " Setup cancelled. Nothing was saved."
    echo ""
    exit 0
fi

# ===========================================================
#  Write backend/.env
# ===========================================================
CORS_LINE=""
if [ -n "$VAL_ALLOWED_ORIGINS" ]; then
    CORS_LINE="ALLOWED_ORIGINS=$VAL_ALLOWED_ORIGINS"
fi

cat > backend/.env << ENVEOF
# Discord OAuth
DISCORD_CLIENT_ID=$VAL_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=$VAL_DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI=$VAL_DISCORD_REDIRECT_URI

# JWT - auto-generated on first start if left as default
JWT_SECRET=change-me-to-a-random-secret
JWT_ALGORITHM=$VAL_JWT_ALGORITHM
JWT_EXPIRY_HOURS=$VAL_JWT_EXPIRY_HOURS

# Database
DATABASE_URL=$VAL_DATABASE_URL

# Frontend
FRONTEND_URL=$VAL_FRONTEND_URL

# CORS
$CORS_LINE

# SMTP
SMTP_HOST=$VAL_SMTP_HOST
SMTP_PORT=$VAL_SMTP_PORT
SMTP_USER=$VAL_SMTP_USER
SMTP_PASSWORD=$VAL_SMTP_PASSWORD
SMTP_FROM=$VAL_SMTP_FROM
BUG_REPORT_TO=$VAL_BUG_REPORT_TO
ENVEOF

echo ""
echo " backend/.env saved successfully!"
echo ""

# ===========================================================
#  Install dependencies and run migrations
# ===========================================================
if ask_yn "Install dependencies and run database migrations now?" "y"; then
    echo ""
    echo " Installing backend dependencies..."
    cd backend
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
        echo " Created virtual environment."
    fi
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    echo ""
    echo " Running database migrations..."
    python -m alembic upgrade head
    echo ""
    cd ..

    echo " Checking frontend dependencies..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo " Installing frontend packages..."
        npm install
    else
        echo " node_modules already exists, skipping npm install."
    fi
    cd ..
    echo ""
else
    echo ""
    echo " Skipped dependency installation."
    echo " Before running, make sure to:"
    echo "   1. cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    echo "   2. python -m alembic upgrade head"
    echo "   3. cd ../frontend && npm install"
    echo ""
fi

echo " Setup complete! Run ./run.sh to start the dashboard."
echo ""
