from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from app.database import get_db
from app.models import Task, Project, User, TaskStatus, TaskPriority, Reminder
from app.schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskBrief, UserBrief,
    GanttTask, KanbanBoard, KanbanColumn,
    ReminderCreate, ReminderResponse
)
from app.auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def get_task_response(task: Task, db: Session) -> TaskResponse:
    """Convert Task model to TaskResponse with computed fields"""
    subtask_count = len(task.subtasks) if task.subtasks else 0
    subtask_completed = len([s for s in task.subtasks if s.status == TaskStatus.DONE]) if task.subtasks else 0

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        color=task.color,
        start_date=task.start_date,
        due_date=task.due_date,
        completed_at=task.completed_at,
        estimated_hours=task.estimated_hours,
        parent_id=task.parent_id,
        position=task.position,
        project_id=task.project_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
        assignees=[UserBrief(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            avatar_color=u.avatar_color
        ) for u in task.assignees],
        subtasks=[TaskBrief(
            id=s.id,
            title=s.title,
            status=s.status,
            priority=s.priority
        ) for s in task.subtasks] if task.subtasks else [],
        dependencies=[TaskBrief(
            id=d.id,
            title=d.title,
            status=d.status,
            priority=d.priority
        ) for d in task.dependencies] if task.dependencies else [],
        subtask_count=subtask_count,
        subtask_completed=subtask_completed,
    )


@router.get("/", response_model=List[TaskResponse])
def get_tasks(
    project_id: Optional[int] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    parent_id: Optional[int] = Query(None, description="Filter by parent task (null for top-level)"),
    include_subtasks: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.subtasks),
        joinedload(Task.dependencies)
    ).join(Project).filter(Project.owner_id == current_user.id)

    if project_id:
        query = query.filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if parent_id is not None:
        query = query.filter(Task.parent_id == parent_id)
    elif not include_subtasks:
        query = query.filter(Task.parent_id == None)

    tasks = query.order_by(Task.position).all()
    return [get_task_response(task, db) for task in tasks]


@router.post("/", response_model=TaskResponse)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == task_data.project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create task
    task_dict = task_data.model_dump(exclude={"assignee_ids", "dependency_ids"})
    db_task = Task(**task_dict)

    # Add assignees
    if task_data.assignee_ids:
        assignees = db.query(User).filter(User.id.in_(task_data.assignee_ids)).all()
        db_task.assignees = assignees

    # Add dependencies
    if task_data.dependency_ids:
        dependencies = db.query(Task).filter(Task.id.in_(task_data.dependency_ids)).all()
        db_task.dependencies = dependencies

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    return get_task_response(db_task, db)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.subtasks),
        joinedload(Task.dependencies)
    ).join(Project).filter(
        Task.id == task_id,
        Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return get_task_response(task, db)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task_data.model_dump(exclude_unset=True)

    # Handle assignees separately
    if "assignee_ids" in update_data:
        assignee_ids = update_data.pop("assignee_ids")
        if assignee_ids is not None:
            assignees = db.query(User).filter(User.id.in_(assignee_ids)).all()
            task.assignees = assignees

    # Handle dependencies separately
    if "dependency_ids" in update_data:
        dependency_ids = update_data.pop("dependency_ids")
        if dependency_ids is not None:
            dependencies = db.query(Task).filter(Task.id.in_(dependency_ids)).all()
            task.dependencies = dependencies

    # Handle status change -> auto-set completed_at
    if "status" in update_data:
        if update_data["status"] == TaskStatus.DONE and task.status != TaskStatus.DONE:
            task.completed_at = datetime.utcnow()
        elif update_data["status"] != TaskStatus.DONE and task.status == TaskStatus.DONE:
            task.completed_at = None

    # Update other fields
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)

    return get_task_response(task, db)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


# ============ Gantt View ============
@router.get("/gantt/{project_id}", response_model=List[GanttTask])
def get_gantt_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.dependencies)
    ).filter(Task.project_id == project_id).order_by(Task.position).all()

    gantt_tasks = []
    for task in tasks:
        # Calculate progress based on subtasks or status
        if task.subtasks:
            completed = len([s for s in task.subtasks if s.status == TaskStatus.DONE])
            progress = (completed / len(task.subtasks)) * 100 if task.subtasks else 0
        else:
            status_progress = {
                TaskStatus.BACKLOG: 0,
                TaskStatus.TODO: 10,
                TaskStatus.IN_PROGRESS: 50,
                TaskStatus.REVIEW: 80,
                TaskStatus.DONE: 100,
            }
            progress = status_progress.get(task.status, 0)

        gantt_tasks.append(GanttTask(
            id=task.id,
            title=task.title,
            start_date=task.start_date,
            due_date=task.due_date,
            status=task.status,
            priority=task.priority,
            color=task.color or project.color,
            progress=progress,
            dependencies=[d.id for d in task.dependencies],
            assignees=[UserBrief(
                id=u.id,
                username=u.username,
                full_name=u.full_name,
                avatar_color=u.avatar_color
            ) for u in task.assignees],
            parent_id=task.parent_id,
        ))

    return gantt_tasks


# ============ Kanban View ============
@router.get("/kanban/{project_id}", response_model=KanbanBoard)
def get_kanban_board(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all top-level tasks
    tasks = db.query(Task).options(
        joinedload(Task.assignees),
        joinedload(Task.subtasks),
        joinedload(Task.dependencies)
    ).filter(
        Task.project_id == project_id,
        Task.parent_id == None
    ).order_by(Task.position).all()

    # Group by status
    columns = []
    status_config = [
        (TaskStatus.BACKLOG, "Backlog", None),
        (TaskStatus.TODO, "To Do", None),
        (TaskStatus.IN_PROGRESS, "In Progress", 3),  # WIP limit
        (TaskStatus.REVIEW, "Review", None),
        (TaskStatus.DONE, "Done", None),
    ]

    for status, title, wip_limit in status_config:
        status_tasks = [get_task_response(t, db) for t in tasks if t.status == status]
        columns.append(KanbanColumn(
            status=status,
            title=title,
            tasks=status_tasks,
            wip_limit=wip_limit,
        ))

    return KanbanBoard(project_id=project_id, columns=columns)


# ============ Bulk Update (for drag-drop) ============
@router.post("/reorder")
def reorder_tasks(
    updates: List[dict],  # [{id, position, status?, parent_id?}]
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    for update in updates:
        task = db.query(Task).join(Project).filter(
            Task.id == update["id"],
            Project.owner_id == current_user.id
        ).first()

        if task:
            task.position = update.get("position", task.position)
            if "status" in update:
                new_status = TaskStatus(update["status"])
                if new_status == TaskStatus.DONE and task.status != TaskStatus.DONE:
                    task.completed_at = datetime.utcnow()
                elif new_status != TaskStatus.DONE and task.status == TaskStatus.DONE:
                    task.completed_at = None
                task.status = new_status
            if "parent_id" in update:
                task.parent_id = update["parent_id"]

    db.commit()
    return {"message": "Tasks reordered"}


# ============ Dependency Auto-Adjust ============
@router.post("/{task_id}/adjust-dates")
def adjust_dependent_dates(
    task_id: int,
    new_end_date: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """When a task's end date changes, shift all dependent tasks accordingly"""
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        Project.owner_id == current_user.id
    ).first()

    if not task or not task.due_date:
        raise HTTPException(status_code=404, detail="Task not found or has no due date")

    # Calculate the shift
    shift = new_end_date - task.due_date
    task.due_date = new_end_date
    if task.start_date:
        task.start_date = task.start_date + shift

    # Recursively adjust dependents
    adjusted = [task_id]
    to_process = list(task.dependents)

    while to_process:
        dependent = to_process.pop(0)
        if dependent.id in adjusted:
            continue

        if dependent.start_date:
            dependent.start_date = dependent.start_date + shift
        if dependent.due_date:
            dependent.due_date = dependent.due_date + shift

        adjusted.append(dependent.id)
        to_process.extend(dependent.dependents)

    db.commit()
    return {"message": f"Adjusted {len(adjusted)} tasks", "adjusted_ids": adjusted}


# ============ Reminders ============
@router.post("/{task_id}/reminders", response_model=ReminderResponse)
def create_reminder(
    task_id: int,
    reminder_data: ReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).join(Project).filter(
        Task.id == task_id,
        Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    reminder = Reminder(
        task_id=task_id,
        user_id=current_user.id,
        remind_at=reminder_data.remind_at,
        message=reminder_data.message,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("/{task_id}/reminders", response_model=List[ReminderResponse])
def get_task_reminders(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reminders = db.query(Reminder).filter(
        Reminder.task_id == task_id,
        Reminder.user_id == current_user.id
    ).order_by(Reminder.remind_at).all()
    return reminders


@router.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.user_id == current_user.id
    ).first()

    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    db.delete(reminder)
    db.commit()
    return {"message": "Reminder deleted"}
