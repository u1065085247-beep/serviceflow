from __future__ import annotations

from email.message import EmailMessage
import smtplib
from typing import Optional, Dict, Any

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.config import AppConfig


def _get_config_from_db(db: Optional[Session]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if not db:
        return data
    rows = db.query(AppConfig).all()
    for r in rows:
        data[r.key] = r.value
    return data


def _runtime_email_settings(db: Optional[Session]) -> Dict[str, Any]:
    """
    Merge DB settings with .env defaults. DB overrides .env if present.
    """
    d = _get_config_from_db(db)
    provider = (d.get("email.provider") or settings.EMAIL_PROVIDER or "smtp").lower()
    cfg: Dict[str, Any] = {
        "provider": provider,
        "from_email": d.get("email.from_email") or settings.FROM_EMAIL or "no-reply@serviceflow.local",
        "smtp_host": d.get("smtp.host") or settings.SMTP_HOST,
        "smtp_port": int(d.get("smtp.port")) if d.get("smtp.port") else settings.SMTP_PORT,
        "smtp_user": d.get("smtp.user") or settings.SMTP_USER,
        "smtp_pass": d.get("smtp.pass") or settings.SMTP_PASS,
        "mailjet_key": d.get("mailjet.api_key") or settings.MAILJET_API_KEY,
        "mailjet_secret": d.get("mailjet.api_secret") or settings.MAILJET_API_SECRET,
    }
    return cfg


def _smtp_client(host: Optional[str], port: Optional[int]):
    if not host or not port:
        return None, None  # disabled
    if int(port) == 465:
        client = smtplib.SMTP_SSL(host, int(port))
        starttls = False
    else:
        client = smtplib.SMTP(host, int(port))
        starttls = True
    return client, starttls


def send_email(to_email: str, subject: str, body: str, db: Optional[Session] = None) -> bool:
    """
    Provider-aware email sending.
    - provider=smtp: sends via SMTP_* settings
    - provider=mailjet: sends via Mailjet API
    - provider=console: prints to logs only
    - provider=disabled: returns False
    """
    cfg = _runtime_email_settings(db)
    provider = cfg["provider"]

    if provider == "disabled" or provider is None:
        return False

    if provider == "console":
        print(f"[email console] To: {to_email}\nSubject: {subject}\n\n{body}")
        return True

    if provider == "mailjet":
        key = cfg.get("mailjet_key")
        secret = cfg.get("mailjet_secret")
        from_email = cfg.get("from_email") or "no-reply@serviceflow.local"
        if not key or not secret:
            print("[email] Mailjet configured without API key/secret")
            return False
        try:
            resp = requests.post(
                "https://api.mailjet.com/v3.1/send",
                auth=(key, secret),
                json={
                    "Messages": [
                        {
                            "From": {"Email": from_email, "Name": "ServiceFlow"},
                            "To": [{"Email": to_email}],
                            "Subject": subject,
                            "TextPart": body,
                        }
                    ]
                },
                timeout=10,
            )
            if resp.status_code // 100 == 2:
                return True
            print(f"[email] Mailjet failed {resp.status_code}: {resp.text}")
            return False
        except Exception as e:
            print(f"[email] Mailjet exception: {e}")
            return False

    # default SMTP
    client, starttls = _smtp_client(cfg.get("smtp_host"), cfg.get("smtp_port"))
    if client is None:
        return False

    try:
        if starttls:
            client.starttls()

        user = cfg.get("smtp_user")
        password = cfg.get("smtp_pass")
        if user and password:
            client.login(user, password)

        msg = EmailMessage()
        from_email = cfg.get("from_email") or user or "no-reply@serviceflow.local"
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)

        client.send_message(msg)
        try:
            client.quit()
        except Exception:
            pass
        return True
    except Exception as e:
        print(f"[email] SMTP failed to send to {to_email}: {e}")
        try:
            client.quit()
        except Exception:
            pass
        return False