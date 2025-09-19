from sqlalchemy import String, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None]
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # superadmin|admin|tech|user
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Permission flag for technicians/admins to view across companies
    can_view_all_companies: Mapped[bool] = mapped_column(Boolean, default=False)

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    company: Mapped["Company"] = relationship(back_populates="users")