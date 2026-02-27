"""Application configuration loaded from environment variables."""

import os
import secrets
import logging
from pydantic_settings import BaseSettings
from functools import lru_cache

_DEFAULT_JWT_SECRET = "change-me-to-a-random-secret"


def _ensure_jwt_secret() -> str:
    """Return the JWT secret, auto-generating one if still set to the placeholder.

    When the user hasn't configured JWT_SECRET (env var or .env), generate a
    cryptographically secure random secret, persist it to .env so it survives
    restarts, and return it.
    """
    current = os.getenv("JWT_SECRET", _DEFAULT_JWT_SECRET)
    if current and current != _DEFAULT_JWT_SECRET:
        return current  # user already configured it

    generated = secrets.token_hex(32)

    # Write to .env so the secret is stable across restarts
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        if os.path.exists(env_path):
            # Read, replace or append
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            found = False
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.startswith("JWT_SECRET=") or stripped.startswith("JWT_SECRET ="):
                    lines[i] = f"JWT_SECRET={generated}\n"
                    found = True
                    break

            if not found:
                lines.append(f"\nJWT_SECRET={generated}\n")

            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(lines)
        else:
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(f"JWT_SECRET={generated}\n")

        logging.getLogger(__name__).info(
            "JWT_SECRET was not configured — auto-generated and saved to .env"
        )
    except Exception as exc:
        
        logging.getLogger(__name__).warning(
            "JWT_SECRET auto-generated but could not be saved to .env: %s. "
            "The secret will change on next restart — set JWT_SECRET manually.",
            exc,
        )

    os.environ["JWT_SECRET"] = generated
    return generated


class Settings(BaseSettings):
    # Discord OAuth
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = "http://localhost:8000/auth/discord/callback"

    # JWT
    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 72

    # Database
    database_url: str = "sqlite+aiosqlite:///./osr_web.db"

    # Frontend
    frontend_url: str = "http://localhost:3000"

    # Registration — when False, only users with an invite link can register
    allow_public_registration: bool = False

    # CORS — comma-separated origins, or "*" for all
    allowed_origins: str = ""

    # SMTP — for bug report emails
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    bug_report_to: str = ""  # recipient email for bug reports

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    # Ensure JWT_SECRET is set before pydantic reads the environment
    _ensure_jwt_secret()
    return Settings()
