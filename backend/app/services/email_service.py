"""
Email service for sending work order and inspection notifications.

When SMTP_HOST is configured, emails are sent via smtplib.
When SMTP_HOST is not set, emails are logged (preview mode) and the
generated HTML is returned to the caller for development/preview.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(getattr(settings, "smtp_host", ""))


def send_email(
    to: str,
    subject: str,
    html_body: str,
    cc: str | None = None,
) -> str:
    """
    Send an email or log it in preview mode.

    Returns:
        "sent" if SMTP delivered the email.
        "preview" if SMTP is not configured (dev mode).
    """
    if not _smtp_configured():
        logger.info(
            "SMTP not configured — email preview mode.\n"
            "  To: %s\n  CC: %s\n  Subject: %s\n"
            "  Body length: %d chars",
            to,
            cc or "(none)",
            subject,
            len(html_body),
        )
        return "preview"

    # Build the email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = getattr(settings, "smtp_from", "noreply@assetlink.com")
    msg["To"] = to
    if cc:
        msg["Cc"] = cc

    msg.attach(MIMEText(html_body, "html"))

    recipients = [to]
    if cc:
        recipients.append(cc)

    smtp_host = getattr(settings, "smtp_host", "")
    smtp_port = int(getattr(settings, "smtp_port", 587))
    smtp_user = getattr(settings, "smtp_user", "")
    smtp_password = getattr(settings, "smtp_password", "")
    smtp_use_tls = getattr(settings, "smtp_use_tls", True)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if smtp_use_tls:
            server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.sendmail(msg["From"], recipients, msg.as_string())

    logger.info("Email sent to %s (cc: %s) — subject: %s", to, cc or "none", subject)
    return "sent"
