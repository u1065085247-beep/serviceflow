from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, resolve_company_scope
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_scope),
    active: Optional[bool] = Query(None, description="Filtrar por is_active"),
    role_filter: Optional[str] = Query(None, description="Filtrar por rol"),
):
    role = (user._token_payload or {}).get("role")
    qs = db.query(User)
    if role == "superadmin":
        pass
    elif role in {"admin", "tech"}:
        qs = qs.filter(User.company_id == company_id)
    else:
        # regular user: solo él
        qs = qs.filter(User.id == user.id)

    if active is not None:
        qs = qs.filter(User.is_active.is_(active))
    if role_filter:
        qs = qs.filter(User.role == role_filter)
    return qs.all()


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_scope),
):
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    new_company_id = payload.company_id
    new_role = payload.role

    if role == "admin":
        # Un admin solo puede crear usuarios en su propia empresa
        new_company_id = user.company_id
        # Y no puede crear superadmin ni admin. Requisito: página de creación de técnicos
        if new_role not in {"tech"}:
            raise HTTPException(status_code=403, detail="Admins can only create technicians (role='tech')")
        # Si intentan forzar can_view_all_companies lo permitimos, es una capacidad del admin decidirlo
        # pero queda asociado a su empresa

    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=new_role,
        company_id=new_company_id,
        is_active=payload.is_active,
        can_view_all_companies=payload.can_view_all_companies,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_scope),
):
    role = (current._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"} and current.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # Admin no puede tocar usuarios de otra empresa (independiente del header)
    if role == "admin" and u.company_id != current.company_id and current.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.email is not None:
        u.email = payload.email
    if payload.full_name is not None:
        u.full_name = payload.full_name
    if payload.role is not None:
        # Un admin no puede promover a admin/superadmin ni degradar entre empresas
        if role == "admin" and payload.role not in {"tech", "user"}:
            raise HTTPException(status_code=403, detail="Admins can only set role to 'tech' or 'user'")
        u.role = payload.role
    if payload.company_id is not None:
        if role != "superadmin":
            raise HTTPException(status_code=403, detail="Only superadmin can move users between companies")
        u.company_id = payload.company_id
    if payload.is_active is not None:
        u.is_active = payload.is_active
    if payload.can_view_all_companies is not None:
        if role not in {"superadmin", "admin"}:
            raise HTTPException(status_code=403, detail="Forbidden")
        u.can_view_all_companies = payload.can_view_all_companies
    if payload.password:
        u.hashed_password = get_password_hash(payload.password)

    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_scope),
):
    role = (current._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if role == "admin" and u.company_id != current.company_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(u)
    db.commit()
    return {"ok": True}