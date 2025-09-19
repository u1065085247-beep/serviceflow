from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin", "tech"}:
        # usuarios solo pueden ver su propia empresa
        return db.query(Company).filter(Company.id == user.company_id).all()
    # admin/tech/superadmin ven todas (si quieres limitar admin/tech, podemos filtrar)
    return db.query(Company).order_by(Company.name.asc()).all()


@router.post("/", response_model=CompanyOut)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin", "tech"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    comp = Company(name=payload.name)
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int, payload: CompanyUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    comp = db.get(Company, company_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")
    if payload.name is not None:
        comp.name = payload.name
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = (user._token_payload or {}).get("role")
    if role != "superadmin":
        raise HTTPException(status_code=403, detail="Forbidden")
    comp = db.get(Company, company_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}