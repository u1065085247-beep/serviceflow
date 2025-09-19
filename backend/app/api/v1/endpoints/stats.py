from datetime import datetime, timedelta
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, resolve_company_scope
from app.models.ticket import Ticket
from app.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


def _period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    if period == "year":
        return now - timedelta(days=365)
    return now - timedelta(days=7)


@router.get("/tickets")
def ticket_stats(
    period: str = Query("week", pattern="^(week|month|year)$"),
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin", "tech"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    start = _period_start(period)

    # Base query with company scope (admins/tech restricted; superadmin can see all)
    qs = db.query(Ticket)
    if role == "superadmin":
        pass
    else:
        qs = qs.filter(Ticket.company_id == company_id)

    # Slice by period
    tickets = qs.filter(Ticket.created_at >= start).all()

    # Technician performance
    totals: Dict[int, int] = {}
    resolved: Dict[int, int] = {}

    for t in tickets:
        if t.assignee_id:
            totals[t.assignee_id] = totals.get(t.assignee_id, 0) + 1
        if t.assignee_id and t.status == "closed" and t.resolved_at and t.resolved_at >= start:
            resolved[t.assignee_id] = resolved.get(t.assignee_id, 0) + 1

    # user directory for names
    tech_qs = db.query(User)
    if role == "superadmin":
        techs = tech_qs.filter(User.role == "tech").all()
    else:
        techs = tech_qs.filter(User.company_id == company_id, User.role == "tech").all()

    tech_items = []
    for u in techs:
        tot = totals.get(u.id, 0)
        res = resolved.get(u.id, 0)
        percent = (res / tot * 100.0) if tot else 0.0
        tech_items.append(
            {
                "user_id": u.id,
                "name": u.full_name or u.email,
                "resolved": res,
                "total": tot,
                "percent": round(percent, 1),
            }
        )

    # Urgent unassigned (opened in any time window; alerting prioritizes current backlog)
    urgent_unassigned = qs.filter(Ticket.priority == "urgent", Ticket.assignee_id.is_(None), Ticket.status != "closed").count()

    # Pending user approvals (inactive)
    pending_approvals = db.query(User)
    if role != "superadmin":
        pending_approvals = pending_approvals.filter(User.company_id == company_id)
    pending_approvals = pending_approvals.filter(User.is_active.is_(False)).count()

    # Hardware tickets (heurística hasta que tengamos campo dedicado)
    # Consideramos título o descripción que contenga 'hardware' (case-insensitive)
    hardware_q = qs.filter(
        (Ticket.title.ilike("%hardware%")) | (Ticket.description.ilike("%hardware%"))
    )
    hardware_total = hardware_q.count()
    hardware_open = hardware_q.filter(Ticket.status != "closed").count()
    hardware_closed = hardware_q.filter(Ticket.status == "closed").count()

    return {
        "period": period,
        "since": start.isoformat(),
        "techs": tech_items,
        "urgent_unassigned": urgent_unassigned,
        "pending_approvals": pending_approvals,
        "hardware": {
            "total": hardware_total,
            "open": hardware_open,
            "closed": hardware_closed,
        },
        "now": datetime.utcnow().isoformat(),
    }