from pydantic import BaseModel


class UserBase(BaseModel):
    # Permitimos dominios .local y otros en desarrollo; validación avanzada puede hacerse en capa de servicio.
    email: str
    full_name: str | None = None
    role: str
    company_id: int
    is_active: bool = True
    can_view_all_companies: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    company_id: int | None = None
    is_active: bool | None = None
    can_view_all_companies: bool | None = None
    password: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    company_id: int
    is_active: bool
    can_view_all_companies: bool

    class Config:
        from_attributes = True