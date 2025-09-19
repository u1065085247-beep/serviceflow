from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, resolve_company_scope
from app.models.ticket import Ticket
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    role = (user._token_payload or {}).get("role")

    qs = db.query(Ticket)
    if role == "superadmin":
        pass  # todos
    elif role == "admin":
        qs = qs.filter(Ticket.company_id == company_id)
    elif role == "tech":
        if getattr(user, "can_view_all_companies", False):
            pass
        else:
            qs = qs.filter(Ticket.company_id == company_id)
    else:
        qs = qs.filter(Ticket.company_id == company_id)

    tickets = qs.all()

    total = len(tickets)
    by_status = Counter(t.status for t in tickets)
    by_priority = Counter(t.priority for t in tickets)

    open_count = by_status.get("open", 0)
    in_progress = by_status.get("in_progress", 0)
    closed = by_status.get("closed", 0)

    # KPIs simples
    kpis = {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "closed": closed,
        "sla": 0.87,  # placeholder
    }

    # Promedio de resolución (mock si no hay datos de cierre reales)
    now = datetime.utcnow()
    trend = [
        {"label": (now - timedelta(weeks=i)).strftime("%d/%m"), "avg_hours": max(1.0, 4.0 - i * 0.6)}
        for i in reversed(range(4))
    ]

    # Rendimiento técnico (placeholder por número de tickets cerrados)
    tech_performance: dict[str, int] = {}
    for t in tickets:
        if t.assignee and t.status == "closed":
            name = t.assignee.full_name or f"User {t.assignee_id}"
            tech_performance[name] = tech_performance.get(name, 0) + 1

    return {
        "kpis": kpis,
        "by_status": by_status,
        "by_priority": by_priority,
        "resolution_trend": trend,
        "tech_performance": tech_performance,
    }