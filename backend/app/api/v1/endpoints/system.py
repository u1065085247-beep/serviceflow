from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.config import AppConfig
from app.schemas.system import EmailConfigIn, EmailConfigOut
from app.core.config import settings
from app.services.email import send_email

router = APIRouter(prefix="/system", tags=["system"])


def _get_all(db: Session) -> Dict[str, str]:
    return {r.key: r.value for r in db.query(AppConfig).all()}


def _set_many(db: Session, data: Dict[str, str], secrets: set[str] | None = None):
    secrets = secrets or set()
    for k, v in data.items():
        row = db.query(AppConfig).filter(AppConfig.key == k).first()
        if row:
            row.value = v
        else:
            row = AppConfig(key=k, value=v, is_secret=(k in secrets))
            db.add(row)
    db.commit()


@router.get("/email-config", response_model=EmailConfigOut)
def get_email_config(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    role = (current._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    data = _get_all(db)
    provider = (data.get("email.provider") or settings.EMAIL_PROVIDER or "smtp").lower()
    from_email = data.get("email.from_email") or settings.FROM_EMAIL

    smtp_host = data.get("smtp.host") or settings.SMTP_HOST
    smtp_port = int(data["smtp.port"]) if data.get("smtp.port") else settings.SMTP_PORT
    smtp_user = data.get("smtp.user") or settings.SMTP_USER
    smtp_pass = data.get("smtp.pass") or settings.SMTP_PASS

    has_mailjet_keys = bool(data.get("mailjet.api_key") or settings.MAILJET_API_KEY) and bool(
        data.get("mailjet.api_secret") or settings.MAILJET_API_SECRET
    )

    return EmailConfigOut(
        provider=provider,
        from_email=from_email,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        has_smtp_pass=bool(smtp_pass),
        has_mailjet_keys=has_mailjet_keys,
    )


@router.put("/email-config", response_model=EmailConfigOut)
def update_email_config(
    payload: EmailConfigIn,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    role = (current._token_payload or {}).get("role")
    if role != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can update system config")

    kv: Dict[str, str] = {}
    secrets: set[str] = set()

    kv["email.provider"] = payload.provider
    if payload.from_email is not None:
        kv["email.from_email"] = payload.from_email

    if payload.smtp_host is not None:
        kv["smtp.host"] = payload.smtp_host
    if payload.smtp_port is not None:
        kv["smtp.port"] = str(payload.smtp_port)
    if payload.smtp_user is not None:
        kv["smtp.user"] = payload.smtp_user
    if payload.smtp_pass is not None:
        kv["smtp.pass"] = payload.smtp_pass
        secrets.add("smtp.pass")

    if payload.mailjet_api_key is not None:
        kv["mailjet.api_key"] = payload.mailjet_api_key
        secrets.add("mailjet.api_key")
    if payload.mailjet_api_secret is not None:
        kv["mailjet.api_secret"] = payload.mailjet_api_secret
        secrets.add("mailjet.api_secret")

    _set_many(db, kv, secrets)

    # return effective config (masking secrets)
    return get_email_config(db, current)


@router.post("/email/test")
def email_test(
    payload: dict,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    role = (current._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    to = payload.get("to")
    if not to:
        raise HTTPException(status_code=422, detail="Missing 'to' field")
    subject = payload.get("subject") or "Prueba de correo - ServiceFlow"
    body = payload.get("body") or "Este es un correo de prueba de ServiceFlow."

    ok = send_email(to, subject, body, db)
    return {"ok": bool(ok)}