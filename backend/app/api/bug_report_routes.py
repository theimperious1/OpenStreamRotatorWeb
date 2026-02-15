"""Bug report endpoint — sends reports via email."""

import logging
import smtplib
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.models import User
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bug-reports"])


class BugReportCreate(BaseModel):
    title: str
    description: str
    steps_to_reproduce: str = ""
    severity: str = "medium"  # low, medium, high, critical


@router.post("/bug-reports", status_code=status.HTTP_201_CREATED)
async def submit_bug_report(
    body: BugReportCreate,
    user: User = Depends(get_current_user),
):
    """Submit a bug report via email. Requires authentication."""
    settings = get_settings()

    if not settings.smtp_host or not settings.bug_report_to:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bug reporting is not configured. Ask the admin to set SMTP and BUG_REPORT_TO in .env.",
        )

    subject = f"[OSR Bug Report] [{body.severity.upper()}] {body.title}"
    email_body = (
        f"Bug Report from: {user.discord_username} ({user.discord_id})\n"
        f"Severity: {body.severity}\n"
        f"{'=' * 50}\n\n"
        f"Title: {body.title}\n\n"
        f"Description:\n{body.description}\n\n"
    )
    if body.steps_to_reproduce:
        email_body += f"Steps to Reproduce:\n{body.steps_to_reproduce}\n"

    msg = MIMEText(email_body, "plain")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = settings.bug_report_to

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info(f"Bug report sent by {user.discord_username}: {body.title}")
        return {"ok": True, "message": "Bug report submitted successfully."}
    except Exception as e:
        logger.error(f"Failed to send bug report email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send bug report email. Please try again later.",
        )
