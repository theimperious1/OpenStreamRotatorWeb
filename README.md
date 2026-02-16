<p align="center">
  <img src=".github/assets/osr-banner-1500x500.png" alt="OpenStreamRotatorWeb" width="100%" />
</p>

Web dashboard for [OpenStreamRotator](https://github.com/theimperious1/OpenStreamRotator) — monitor and control your 24/7 stream automation from any browser.

> **Like this project?** [Buy me a coffee ☕](https://buymeacoffee.com/theimperious1)

## Features

- **Real-time monitoring** — Live stream status, current video, playlist, category, OBS connection state, and uptime via WebSocket
- **Remote control** — Skip videos, trigger rotations, pause/resume streams, toggle playlists, and manage settings from anywhere
- **Team collaboration** — Invite others via Discord, assign roles, and manage access through a role-based permission system
- **Live log streaming** — View OSR instance logs in real time with level filtering and search
- **Stream preview** — Watch the live OBS output directly in the browser via HLS
- **Prepared rotations** — Pre-build rotation sets and schedule them for execution on a specific date
- **Playlist management** — Enable/disable playlists, edit categories and priorities, add or remove playlists
- **Settings editor** — Edit all hot-swappable OSR settings and environment variables remotely
- **Discord OAuth** — Sign in with Discord, no separate account needed

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| Auth | Discord OAuth2 → JWT (HS256) |
| Database | SQLite (dev) or PostgreSQL 16 (prod) |
| Real-time | WebSocket (FastAPI native) |
| Infrastructure | Docker Compose |

## Prerequisites

- **Python 3.12+**
- **Node.js 22+**
- **PostgreSQL 16** (production) or SQLite (development)
- A **Discord application** with OAuth2 configured ([Discord Developer Portal](https://discord.com/developers/applications))

## Installation

### With Docker (recommended)

```bash
git clone https://github.com/theimperious1/OpenStreamRotatorWeb.git
cd OpenStreamRotatorWeb
cp backend/.env.example backend/.env
# Edit backend/.env with your Discord app credentials and a random JWT secret
docker compose up
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:8000`.

### Manual Setup

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
alembic upgrade head
uvicorn app.main:app --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend auto-detects the backend at the same hostname on port 8000. To override, set `NEXT_PUBLIC_API_URL` in the frontend environment.

## Configuration

### Backend Environment Variables (`.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_CLIENT_ID` | Yes | — | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | — | Discord application client secret |
| `DISCORD_REDIRECT_URI` | No | `http://localhost:8000/auth/discord/callback` | OAuth callback URL |
| `JWT_SECRET` | Yes | — | Random secret for signing JWTs |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `JWT_EXPIRY_HOURS` | No | `72` | Token lifetime in hours |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./osr_web.db` | Database connection string |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend origin for OAuth redirects |
| `ALLOWED_ORIGINS` | No | *(auto: localhost + IP)* | Comma-separated CORS origins |

For production, swap the `DATABASE_URL` to PostgreSQL:
```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/osr_web
```

### Discord App Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Under **OAuth2**, add your redirect URI (default: `http://localhost:8000/auth/discord/callback`).
3. Copy the **Client ID** and **Client Secret** into your `.env` file.
4. The only OAuth scope needed is `identify`.

## Connecting an OSR Instance

1. Sign in to the web dashboard and create a team.
2. On the **Team** page, register a new OSR instance — this generates an API key.
3. In your OSR instance's `.env` file, set:
   ```
   WEB_DASHBOARD_URL=http://your-dashboard-host:8000
   WEB_DASHBOARD_API_KEY=your-generated-api-key
   ```
4. Start or restart OSR. It will connect to the dashboard via WebSocket and begin streaming state and logs.

## Role-Based Access Control

Teams support four roles with hierarchical permissions:

| Capability | Admin | Content Manager | Moderator | Viewer |
|---|---|---|---|---|
| View dashboard, queue, playlists, preview | ✅ | ✅ | ✅ | ✅ |
| View logs | ✅ | ✅ | ✅ | ❌ |
| Send commands (skip, pause, trigger rotation) | ✅ | ✅ | ✅ | ❌ |
| Manage playlists, prepared rotations, settings | ✅ | ✅ | ❌ | ❌ |
| Edit environment variables | ✅ | ❌ | ❌ | ❌ |
| Create/manage invite links | ✅ | ✅ | ❌ | ❌ |
| Change member roles, remove members | ✅ | ❌ | ❌ | ❌ |
| Create/delete OSR instances, see API keys | ✅ | ❌ | ❌ | ❌ |

## Dashboard Pages

| Page | Description |
|---|---|
| **Dashboard** | Stream status overview — current video, playlist, category, uptime, OBS connection, pause/resume control |
| **Playlists** | View and manage all playlists — enable/disable, edit categories and priorities, add or remove |
| **Queue** | Current video queue with skip and trigger-rotation controls, download progress |
| **Prepared** | Pre-build rotation sets, schedule them on a calendar, track status from creation through execution |
| **Logs** | Real-time log stream with level filtering (info/warning/error/debug) and text search |
| **Preview** | Live HLS stream preview with viewer count; configure the HLS URL |
| **Team** | Member management, invite links (with role, expiry, usage limits), OSR instance registration |
| **Settings** | All hot-swappable OSR settings and environment variable editor |
| **Help** | Feature guide and FAQ with collapsible sections |

## Architecture

```
┌──────────┐   WebSocket    ┌──────────┐   WebSocket    ┌──────────┐
│   OSR    │ ──────────────→│ Backend  │←──────────────→│ Browser  │
│ Instance │  state + logs  │ (FastAPI)│  state + logs  │ (Next.js)│
│          │←───────────────│          │  + commands    │          │
│          │   commands     │          │                │          │
└──────────┘                └──────────┘                └──────────┘
                                 │
                                 ▼
                            ┌──────────┐
                            │ Database │
                            │ (SQLite/ │
                            │  Postgres)│
                            └──────────┘
```

- **OSR → Backend**: Pushes state snapshots and log entries via WebSocket. Receives commands.
- **Browser → Backend**: Subscribes to an instance's live data. Sends commands that are forwarded to OSR.
- **State caching**: New browser connections receive the latest state immediately without waiting for the next OSR update.
- **Log buffer**: Up to 500 recent log entries are cached per instance and sent to new connections.

## Database Migrations

After pulling new changes, run migrations before starting the backend:

```bash
cd backend
alembic upgrade head
```

## License

See [LICENSE.md](LICENSE.md) for details.
