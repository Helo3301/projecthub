from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from app.models import TaskStatus, TaskPriority


# ============ User Schemas ============
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    avatar_color: Optional[str] = "#4F46E5"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_color: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserBrief(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    avatar_color: str

    class Config:
        from_attributes = True


# ============ Project Schemas ============
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#4F46E5"
    icon: Optional[str] = "folder"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_archived: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: int
    owner_id: int
    is_archived: bool
    created_at: datetime
    task_count: Optional[int] = 0
    completed_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ============ Task Schemas ============
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[TaskStatus] = TaskStatus.BACKLOG
    priority: Optional[TaskPriority] = TaskPriority.MEDIUM
    color: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    parent_id: Optional[int] = None
    position: Optional[int] = 0


class TaskCreate(TaskBase):
    project_id: int
    assignee_ids: Optional[List[int]] = []
    dependency_ids: Optional[List[int]] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    color: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    parent_id: Optional[int] = None
    position: Optional[int] = None
    assignee_ids: Optional[List[int]] = None
    dependency_ids: Optional[List[int]] = None


class TaskBrief(BaseModel):
    id: int
    title: str
    status: TaskStatus
    priority: TaskPriority

    class Config:
        from_attributes = True


class TaskResponse(TaskBase):
    id: int
    project_id: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    assignees: List[UserBrief] = []
    subtasks: List["TaskBrief"] = []
    dependencies: List[TaskBrief] = []
    subtask_count: Optional[int] = 0
    subtask_completed: Optional[int] = 0

    class Config:
        from_attributes = True


# ============ Reminder Schemas ============
class ReminderBase(BaseModel):
    remind_at: datetime
    message: Optional[str] = None


class ReminderCreate(ReminderBase):
    task_id: int


class ReminderResponse(ReminderBase):
    id: int
    task_id: int
    user_id: int
    is_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Gantt Schemas ============
class GanttTask(BaseModel):
    id: int
    title: str
    start_date: Optional[datetime]
    due_date: Optional[datetime]
    status: TaskStatus
    priority: TaskPriority
    color: Optional[str]
    progress: float  # 0-100
    dependencies: List[int]  # List of task IDs this depends on
    assignees: List[UserBrief]
    parent_id: Optional[int]

    class Config:
        from_attributes = True


# ============ Kanban Schemas ============
class KanbanColumn(BaseModel):
    status: TaskStatus
    title: str
    tasks: List[TaskResponse]
    wip_limit: Optional[int] = None


class KanbanBoard(BaseModel):
    project_id: int
    columns: List[KanbanColumn]


# ============ Auth Schemas ============
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str
