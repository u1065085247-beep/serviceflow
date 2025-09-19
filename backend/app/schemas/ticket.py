from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class TicketCreate(BaseModel):
    title: str
    description: str | None = None
    status: str = "open"
    priority: str = "normal"
    assignee_id: int | None = None


class TicketUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    assignee_id: int | None = None


class TicketResolve(BaseModel):
    resolution_summary: str = Field(..., min_length=3)
    time_spent_hhmm: str = Field(..., description="Formato HH:MM")
    status: str = "closed"
    priority: str | None = None

    @field_validator("time_spent_hhmm")
    @classmethod
    def validate_hhmm(cls, v: str) -> str:
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("Formato debe ser HH:MM")
        hh, mm = parts
        if not (hh.isdigit() and mm.isdigit()):
            raise ValueError("Formato debe ser HH:MM con números")
        h, m = int(hh), int(mm)
        if h < 0 or m < 0 or m > 59:
            raise ValueError("Minutos deben estar entre 00 y 59")
        return v


class TicketOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    priority: str
    requester_id: int
    assignee_id: int | None
    company_id: int
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    resolution_summary: str | None = None
    time_spent_minutes: int | None = 0

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: int
    filename: str
    content_type: str | None
    url: str

    class Config:
        from_attributes = True


# Comments
class CommentIn(BaseModel):
    body: str
    is_public: bool = True


class CommentOut(BaseModel):
    id: int
    user_id: int
    body: str
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Worklogs
class WorklogOut(BaseModel):
    id: int
    user_id: int
    started_at: datetime
    ended_at: datetime | None = None
    # duration computed on backend when ended; for active it's None
    class Config:
        from_attributes = True