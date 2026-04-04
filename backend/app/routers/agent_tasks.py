"""
Agent Tasks Router

Receives task data from Claude Code's TaskCreated hook and serves
it to the dashboard. This is separate from the project-based task
system — these are agent-scoped work items tracked by session ID.

POST /api/agents/{agent_id}/tasks — upsert a task from the hook
GET  /api/agents/{agent_id}/tasks  — list tasks (optional ?status= filter)
"""

import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import Session

from app.database import Base, get_db


# ── Model ────────────────────────────────────────────────────────

class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(255), nullable=False, index=True)
    task_id = Column(String(255), nullable=False, unique=True, index=True)
    subject = Column(String(500), nullable=False)
    description = Column(Text, default="")
    owner = Column(String(255), default="")
    status = Column(String(50), default="pending")  # pending | in_progress | completed
    blocked_by = Column(Text, default="[]")  # JSON array of task_ids
    blocks = Column(Text, default="[]")      # JSON array of task_ids
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ── Schemas ──────────────────────────────────────────────────────

class AgentTaskCreate(BaseModel):
    task_id: str
    subject: str
    description: Optional[str] = ""
    owner: Optional[str] = ""
    status: Optional[str] = "pending"
    blocked_by: Optional[List[str]] = []
    blocks: Optional[List[str]] = []


class AgentTaskResponse(BaseModel):
    task_id: str
    subject: str
    description: str
    owner: str
    status: str
    blocked_by: List[str]
    blocks: List[str]
    created_at: str

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────

def _parse_json_array(raw: str) -> List[str]:
    """Safely parse a JSON-encoded array from a TEXT column."""
    try:
        val = json.loads(raw)
        return val if isinstance(val, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _task_to_response(task: AgentTask) -> dict:
    return {
        "task_id": task.task_id,
        "subject": task.subject,
        "description": task.description or "",
        "owner": task.owner or "",
        "status": task.status or "pending",
        "blocked_by": _parse_json_array(task.blocked_by),
        "blocks": _parse_json_array(task.blocks),
        "created_at": task.created_at.isoformat() if task.created_at else "",
    }


# ── Router ───────────────────────────────────────────────────────

router = APIRouter(prefix="/agents", tags=["Agent Tasks"])


@router.post("/{agent_id}/tasks", status_code=201)
async def create_agent_task(
    agent_id: str,
    payload: AgentTaskCreate,
    db: Session = Depends(get_db),
):
    """Receive a task from the TaskCreated hook.  Upserts by task_id."""

    if not payload.task_id:
        raise HTTPException(status_code=400, detail="Missing required field: task_id")
    if not payload.subject:
        raise HTTPException(status_code=400, detail="Missing required field: subject")

    # Validate status
    valid_statuses = {"pending", "in_progress", "completed"}
    status = payload.status if payload.status in valid_statuses else "pending"

    existing = db.query(AgentTask).filter(AgentTask.task_id == payload.task_id).first()

    if existing:
        existing.agent_id = agent_id
        existing.subject = payload.subject
        existing.description = payload.description or ""
        existing.owner = payload.owner or ""
        existing.status = status
        existing.blocked_by = json.dumps(payload.blocked_by or [])
        existing.blocks = json.dumps(payload.blocks or [])
        db.commit()
        db.refresh(existing)
        from starlette.responses import JSONResponse
        return JSONResponse(
            status_code=200,
            content={"status": "updated", "task_id": existing.task_id},
        )

    new_task = AgentTask(
        agent_id=agent_id,
        task_id=payload.task_id,
        subject=payload.subject,
        description=payload.description or "",
        owner=payload.owner or "",
        status=status,
        blocked_by=json.dumps(payload.blocked_by or []),
        blocks=json.dumps(payload.blocks or []),
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    from starlette.responses import JSONResponse
    return JSONResponse(
        status_code=201,
        content={"status": "success", "task_id": new_task.task_id},
    )


@router.get("/{agent_id}/tasks")
async def get_agent_tasks(
    agent_id: str,
    status: Optional[str] = Query(None, description="Comma-separated status filter: pending,in_progress,completed"),
    db: Session = Depends(get_db),
):
    """Return all tasks for the given agent, newest first."""

    query = db.query(AgentTask).filter(AgentTask.agent_id == agent_id)

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if statuses:
            query = query.filter(AgentTask.status.in_(statuses))

    tasks = query.order_by(AgentTask.created_at.desc()).all()

    return {"tasks": [_task_to_response(t) for t in tasks]}
