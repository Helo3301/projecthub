from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from app.database import get_db
from app.models import Task, Project, User
from app.schemas import TaskResponse, UserBrief
from app.auth import get_current_user

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("/tasks")
def get_calendar_tasks(
    start_date: date = Query(..., description="Start of date range"),
    end_date: date = Query(..., description="End of date range"),
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tasks that fall within a date range for calendar view"""
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())

    query = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.project)
    ).join(Project).filter(Project.owner_id == current_user.id)

    if project_id:
        query = query.filter(Task.project_id == project_id)

    # Tasks that overlap with the date range
    query = query.filter(
        or_(
            # Has due date in range
            and_(Task.due_date >= start_datetime, Task.due_date <= end_datetime),
            # Has start date in range
            and_(Task.start_date >= start_datetime, Task.start_date <= end_datetime),
            # Spans the entire range
            and_(Task.start_date <= start_datetime, Task.due_date >= end_datetime),
        )
    )

    tasks = query.all()

    # Format for calendar
    events = []
    for task in tasks:
        events.append({
            "id": task.id,
            "title": task.title,
            "start": task.start_date.isoformat() if task.start_date else task.due_date.isoformat() if task.due_date else None,
            "end": task.due_date.isoformat() if task.due_date else task.start_date.isoformat() if task.start_date else None,
            "color": task.color or task.project.color,
            "status": task.status.value,
            "priority": task.priority.value,
            "project_id": task.project_id,
            "project_name": task.project.name,
            "assignees": [UserBrief(
                id=u.id,
                username=u.username,
                full_name=u.full_name,
                avatar_color=u.avatar_color
            ).model_dump() for u in task.assignees],
        })

    return events


@router.get("/upcoming")
def get_upcoming_deadlines(
    days: int = Query(7, description="Number of days to look ahead"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tasks with upcoming deadlines"""
    now = datetime.utcnow()
    end_date = now + timedelta(days=days)

    tasks = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.project)
    ).join(Project).filter(
        Project.owner_id == current_user.id,
        Task.due_date >= now,
        Task.due_date <= end_date,
        Task.status != "done"
    ).order_by(Task.due_date).all()

    return [{
        "id": task.id,
        "title": task.title,
        "due_date": task.due_date.isoformat(),
        "priority": task.priority.value,
        "project_name": task.project.name,
        "project_color": task.project.color,
        "days_until": (task.due_date.date() - now.date()).days,
    } for task in tasks]


from datetime import timedelta
