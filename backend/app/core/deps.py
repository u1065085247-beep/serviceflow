from typing import Generator, Optional

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get(User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")
    user._token_payload = payload  # attach token payload (role, company_id)
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        role = (user._token_payload or {}).get("role")
        if role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return checker


def resolve_company_scope(
    user: User = Depends(get_current_user),
    x_company_id: Optional[int] = Header(None, alias="X-Company-Id"),
) -> int:
    """
    Returns the effective company_id for the request.
    - user: forced to user's company_id
    - admin: can override using X-Company-Id
    - tech: can override only if can_view_all_companies=True
    - superadmin: always can override
    """
    payload = getattr(user, "_token_payload", {}) or {}
    role = payload.get("role")
    if role == "superadmin" and x_company_id:
        return int(x_company_id)
    if role == "admin" and x_company_id:
        return int(x_company_id)
    if role == "tech" and getattr(user, "can_view_all_companies", False) and x_company_id:
        return int(x_company_id)
    return int(payload.get("company_id"))