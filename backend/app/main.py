from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

# DB models and engine for simple auto-create/seed
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User
from app.models.ticket import Ticket, Attachment, Comment  # noqa: F401
from app.models.config import AppConfig  # noqa: F401  ensure table is created

app = FastAPI(title="ServiceFlow API", version="0.1.0")

# CORS - ajusta origins según tu frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción restringe a tu dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Crear carpeta de uploads si no existe
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Crear tablas (solo para desarrollo/pruebas; en prod usar Alembic)
    Base.metadata.create_all(bind=engine)

    # Seed demo si no existe nada: empresas, usuarios (admin/tech/user) y tickets
    db = SessionLocal()
    try:
        has_company = db.query(Company).first()
        if not has_company:
            # Empresas
            acme = Company(name="Acme Inc.")
            globex = Company(name="Globex Corp.")
            db.add_all([acme, globex])
            db.flush()

            # Superadmin (scope global)
            root = User(
                email="superadmin@serviceflow.local",
                hashed_password=get_password_hash("admin123"),
                full_name="Super Admin",
                role="superadmin",
                company_id=acme.id,
                is_active=True,
            )

            # Admins (uno por empresa)
            admin_acme = User(
                email="admin@acme.local",
                hashed_password=get_password_hash("admin123"),
                full_name="Admin Acme",
                role="admin",
                company_id=acme.id,
                is_active=True,
                can_view_all_companies=True,
            )
            admin_globex = User(
                email="admin@globex.local",
                hashed_password=get_password_hash("admin123"),
                full_name="Admin Globex",
                role="admin",
                company_id=globex.id,
                is_active=True,
                can_view_all_companies=False,
            )

            # Técnicos
            tech_acme = User(
                email="tech@acme.local",
                hashed_password=get_password_hash("tech123"),
                full_name="Tech Acme",
                role="tech",
                company_id=acme.id,
                is_active=True,
                can_view_all_companies=False,  # por defecto no puede ver todas
            )
            tech_global = User(
                email="tech.global@acme.local",
                hashed_password=get_password_hash("tech123"),
                full_name="Tech Global",
                role="tech",
                company_id=acme.id,
                is_active=True,
                can_view_all_companies=True,  # este sí puede ver y operar en todas
            )

            # Usuarios finales
            user_acme = User(
                email="user@acme.local",
                hashed_password=get_password_hash("user123"),
                full_name="Usuario Acme",
                role="user",
                company_id=acme.id,
                is_active=True,
            )
            user_globex = User(
                email="user@globex.local",
                hashed_password=get_password_hash("user123"),
                full_name="Usuario Globex",
                role="user",
                company_id=globex.id,
                is_active=True,
            )

            db.add_all(
                [
                    root,
                    admin_acme,
                    admin_globex,
                    tech_acme,
                    tech_global,
                    user_acme,
                    user_globex,
                ]
            )
            db.flush()

            # Tickets demo
            tickets = [
                Ticket(
                    title="Error de impresión",
                    description="La impresora no responde",
                    status="open",
                    priority="normal",
                    requester_id=user_acme.id,
                    assignee_id=tech_acme.id,
                    company_id=acme.id,
                ),
                Ticket(
                    title="Correo no sincroniza",
                    description="Outlook deja de sincronizar cada 2 horas",
                    status="in_progress",
                    priority="high",
                    requester_id=user_acme.id,
                    assignee_id=tech_global.id,
                    company_id=acme.id,
                ),
                Ticket(
                    title="Pantalla azul",
                    description="BSOD al iniciar",
                    status="closed",
                    priority="urgent",
                    requester_id=user_globex.id,
                    assignee_id=None,
                    company_id=globex.id,
                ),
            ]
            db.add_all(tickets)
            db.commit()
    finally:
        db.close()


app.include_router(api_router, prefix="/api/v1")