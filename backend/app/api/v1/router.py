from fastapi import APIRouter

# Importa routers explícitamente para evitar módulos parcialmente importados
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.tickets import router as tickets_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.companies import router as companies_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.stats import router as stats_router
from app.api.v1.endpoints.system import router as system_router

api_router = APIRouter()

# Auth
api_router.include_router(auth_router)

# Tickets
api_router.include_router(tickets_router, prefix="/tickets", tags=["tickets"])

# Users
api_router.include_router(users_router)

# Companies
api_router.include_router(companies_router)

# Dashboard
api_router.include_router(dashboard_router)

# Stats
api_router.include_router(stats_router)

# System
api_router.include_router(system_router)