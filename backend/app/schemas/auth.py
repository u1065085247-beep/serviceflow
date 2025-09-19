from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    # Permitimos emails con dominios reservados (e.g., .local) en entornos de dev.
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    role: str
    company_id: int
    is_active: bool

    class Config:
        from_attributes = True