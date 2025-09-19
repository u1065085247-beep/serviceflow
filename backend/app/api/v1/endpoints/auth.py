from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import Token, UserOut

# Prefijo /auth para agrupar endpoints y hacer más claro el include
router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/ping")
def ping():
    return {"ok": True}


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: Session = Depends(get_db),
    email_form: str | None = Form(default=None),
    password_form: str | None = Form(default=None),
):
    # Acepta JSON o form-data
    email: str | None = None
    password: str | None = None

    # Intentar parsear JSON
    try:
        body = await request.json()
        if isinstance(body, dict):
            email = body.get("email")
            password = body.get("password")
    except Exception:
        pass

    # Si no vino JSON, tomar de form-data
    if email is None and email_form is not None:
        email = email_form
    if password is None and password_form is not None:
        password = password_form

    if not email or not password:
        raise HTTPException(status_code=422, detail=[{"msg": "email y password son requeridos"}])

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        {"sub": str(user.id), "role": user.role, "company_id": user.company_id},
        secret=settings.JWT_SECRET,
        expires_minutes=settings.JWT_EXPIRE_MIN,
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user