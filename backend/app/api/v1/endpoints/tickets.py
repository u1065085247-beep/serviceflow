from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Query, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.deps import get_current_user, get_db, resolve_company_scope
from app.models.ticket import Ticket, Attachment, Comment, Worklog
from app.models.user import User
from app.schemas.ticket import (
    TicketCreate,
    TicketOut,
    AttachmentOut,
    TicketUpdate,
    TicketResolve,
    CommentIn,
    CommentOut,
    WorklogOut,
)
from app.services.storage import StorageService
from app.services.email import send_email

router = APIRouter()


def _assert_ticket_scope(t: Ticket | None, user: User, company_id: int):
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    role = (user._token_payload or {}).get("role")
    if role == "superadmin":
        return
    if role == "admin":
        # admin puede operar si el filtro de company_id coincide
        if t.company_id != company_id:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return
    if role == "tech":
        if getattr(user, "can_view_all_companies", False):
            return
        if t.company_id != company_id:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return
    # user
    if t.company_id != company_id:
        raise HTTPException(status_code=404, detail="Ticket not found")


@router.get("/", response_model=list[TicketOut])
def list_tickets(
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
    x_company_id: Optional[int] = Header(None, alias="X-Company-Id"),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    role = (user._token_payload or {}).get("role")
    qs = db.query(Ticket)

    if role == "superadmin":
        if x_company_id:
            qs = qs.filter(Ticket.company_id == int(x_company_id))
        # sin header: ve todos
    elif role == "admin":
        if x_company_id:
            qs = qs.filter(Ticket.company_id == int(x_company_id))
        else:
            qs = qs.filter(Ticket.company_id == company_id)
    elif role == "tech":
        # técnico solo ve su empresa por defecto; puede override solo si tiene permiso
        if x_company_id and getattr(user, "can_view_all_companies", False):
            qs = qs.filter(Ticket.company_id == int(x_company_id))
        else:
            qs = qs.filter(Ticket.company_id == company_id)
    else:
        # usuario normal: solo su empresa
        qs = qs.filter(Ticket.company_id == company_id)

    if status:
        qs = qs.filter(Ticket.status == status)
    if priority:
        qs = qs.filter(Ticket.priority == priority)
    if assignee_id:
        qs = qs.filter(Ticket.assignee_id == assignee_id)
    if q:
        like = f"%{q}%"
        qs = qs.filter(Ticket.title.ilike(like))

    qs = qs.order_by(Ticket.created_at.desc()).limit(limit).offset(offset)
    return qs.all()


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    return t  # type: ignore[return-value]


@router.post("/", response_model=TicketOut)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    # Users solo pueden crear para su empresa (company_id resuelto). Admin/Tech/Superadmin pueden usar override.
    t = Ticket(
        title=payload.title,
        description=payload.description,
        status=payload.status or "open",
        priority=payload.priority,
        requester_id=user.id,
        assignee_id=payload.assignee_id,
        company_id=company_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin", "tech"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.status is not None:
        t.status = payload.status  # type: ignore[attr-defined]
    if payload.priority is not None:
        t.priority = payload.priority  # type: ignore[attr-defined]
    if payload.assignee_id is not None:
        t.assignee_id = payload.assignee_id  # type: ignore[attr-defined]

    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/{ticket_id}/resolve", response_model=TicketOut)
def resolve_ticket(
    ticket_id: int,
    payload: TicketResolve,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)

    role = (user._token_payload or {}).get("role")
    if role not in {"superadmin", "admin", "tech"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Parse HH:MM
    hh, mm = payload.time_spent_hhmm.split(":")
    minutes = int(hh) * 60 + int(mm)

    t.resolution_summary = payload.resolution_summary  # type: ignore[attr-defined]
    t.time_spent_minutes = minutes  # type: ignore[attr-defined]
    t.status = payload.status or "closed"  # type: ignore[attr-defined]
    if payload.priority is not None:
        t.priority = payload.priority  # type: ignore[attr-defined]
    t.resolved_at = datetime.utcnow()  # type: ignore[attr-defined]

    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# Attachments
@router.post("/{ticket_id}/attachments", response_model=AttachmentOut)
def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)

    storage = StorageService()
    key = f"tickets/{ticket_id}/{file.filename}"
    storage_key = storage.save_file(file.file, key, content_type=file.content_type)
    url = storage.get_file_url(storage_key)

    att = Attachment(
        ticket_id=ticket_id,
        filename=file.filename,
        content_type=file.content_type,
        storage_key=storage_key,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return AttachmentOut(id=att.id, filename=att.filename, content_type=att.content_type, url=url)


@router.get("/{ticket_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)

    storage = StorageService()
    out: list[AttachmentOut] = []
    for att in t.attachments:  # type: ignore[attr-defined]
        out.append(
            AttachmentOut(
                id=att.id,
                filename=att.filename,
                content_type=att.content_type,
                url=storage.get_file_url(att.storage_key),
            )
        )
    return out


# Comments
@router.get("/{ticket_id}/comments", response_model=list[CommentOut])
def list_comments(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    role = (user._token_payload or {}).get("role")
    qs = db.query(Comment).filter(Comment.ticket_id == ticket_id).order_by(Comment.created_at.desc())
    if role == "user":
        qs = qs.filter(Comment.is_public.is_(True))
    return qs.all()


@router.post("/{ticket_id}/comments", response_model=CommentOut)
def add_comment(
    ticket_id: int,
    payload: CommentIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    role = (user._token_payload or {}).get("role")
    is_public = payload.is_public if role in {"superadmin", "admin", "tech"} else True
    c = Comment(ticket_id=ticket_id, user_id=user.id, body=payload.body, is_public=is_public)
    db.add(c)
    db.commit()
    db.refresh(c)

    # Notifications email
    try:
        subject = f"Nueva actividad en tu ticket #{t.id}"
        # Staff -> user (only if public)
        if role in {"superadmin", "admin", "tech"} and is_public and t.requester and t.requester.email:
            to_email = t.requester.email
            body = f"Hola,\n\nHay un nuevo comentario en tu ticket #{t.id} - {t.title}.\n\nComentario:\n{payload.body}\n\n--\nServiceFlow"
            background_tasks.add_task(send_email, to_email, subject, body, db)
        # User -> technician (if assigned)
        if role == "user" and t.assignee and t.assignee.email:
            to_email = t.assignee.email
            body = f"Hola,\n\nEl usuario ha añadido un comentario en el ticket #{t.id} - {t.title}.\n\nComentario:\n{payload.body}\n\n--\nServiceFlow"
            background_tasks.add_task(send_email, to_email, subject, body, db)
    except Exception:
        # Nunca romper la API por el envío de email
        pass

    return c


# Worklogs
@router.get("/{ticket_id}/worklogs", response_model=list[WorklogOut])
def list_worklogs(
    ticket_id: int,
    mine_only: bool = Query(True),
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)
    qs = db.query(Worklog).filter(Worklog.ticket_id == ticket_id)
    role = (user._token_payload or {}).get("role")
    if mine_only or role == "user":
        qs = qs.filter(Worklog.user_id == user.id)
    return qs.order_by(Worklog.started_at.asc()).all()


@router.post("/{ticket_id}/worklogs/start", response_model=WorklogOut)
def start_work(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)

    # Concurrency: no permitir más de un worklog activo para el usuario
    active = db.query(Worklog).filter(Worklog.user_id == user.id, Worklog.ended_at.is_(None)).first()
    if active:
        raise HTTPException(status_code=409, detail="You already have an active worklog")

    wl = Worklog(ticket_id=ticket_id, user_id=user.id)
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl


@router.post("/{ticket_id}/worklogs/stop", response_model=WorklogOut)
def stop_work(
    ticket_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(resolve_company_scope),
    user: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    _assert_ticket_scope(t, user, company_id)

    wl = (
        db.query(Worklog)
        .filter(Worklog.ticket_id == ticket_id, Worklog.user_id == user.id, Worklog.ended_at.is_(None))
        .first()
    )
    if not wl:
        raise HTTPException(status_code=409, detail="No active worklog for this ticket")

    wl.ended_at = datetime.utcnow()
    db.add(wl)
    db.commit()
    db.refresh(wl)
    return wl