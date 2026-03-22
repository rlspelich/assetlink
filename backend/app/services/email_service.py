"""
Email service for sending work order and inspection notifications.

All emails are sent FROM the AssetLink domain (e.g. workorders@assetlink.us).
The sender's name is included in the From header so the recipient knows
who sent it. Reply-To is set to the sender's actual email.

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

# Default from address — all emails come from our domain
DEFAULT_FROM_EMAIL = "workorders@assetlink.us"
DEFAULT_FROM_NAME = "AssetLink"


def _smtp_configured() -> bool:
    return bool(getattr(settings, "smtp_host", ""))


def send_email(
    to: str,
    subject: str,
    html_body: str,
    cc: str | None = None,
    sender_name: str | None = None,
    sender_email: str | None = None,
) -> str:
    """
    Send an email or log it in preview mode.

    Args:
        to: Recipient email address.
        subject: Email subject line.
        html_body: HTML body content.
        cc: Optional CC email address.
        sender_name: Name of the person sending (e.g. "John Smith").
            Appears in From as "John Smith via AssetLink <workorders@assetlink.us>".
        sender_email: Sender's real email for Reply-To header.
            So the recipient can reply directly to the sender.

    Returns:
        "sent" if SMTP delivered the email.
        "preview" if SMTP is not configured (dev mode).
    """
    from_email = getattr(settings, "smtp_from", DEFAULT_FROM_EMAIL)
    from_name = DEFAULT_FROM_NAME

    # Include sender name in the From display
    if sender_name:
        from_name = f"{sender_name} via AssetLink"

    from_header = f"{from_name} <{from_email}>"

    if not _smtp_configured():
        logger.info(
            "SMTP not configured — email preview mode.\n"
            "  From: %s\n  Reply-To: %s\n  To: %s\n  CC: %s\n  Subject: %s\n"
            "  Body length: %d chars",
            from_header,
            sender_email or "(none)",
            to,
            cc or "(none)",
            subject,
            len(html_body),
        )
        return "preview"

    # Build the email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to

    # Reply-To goes to the sender's real email, not the system address
    if sender_email:
        msg["Reply-To"] = sender_email

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
        server.sendmail(from_email, recipients, msg.as_string())

    logger.info("Email sent to %s (cc: %s) — subject: %s", to, cc or "none", subject)
    return "sent"
