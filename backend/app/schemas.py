from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List, Any
from app.models import TaskStatus, TaskPriority, AgentType, AgentStatus, MessageStatus, DirectiveType


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
    correlation_id: Optional[str] = None
    parent_id: Optional[int] = None
    position: Optional[int] = 0


class SubtaskInput(BaseModel):
    id: Optional[int] = None  # None for new subtasks
    title: str
    completed: bool = False


class TaskCreate(TaskBase):
    project_id: int
    assignee_ids: Optional[List[int]] = []
    dependency_ids: Optional[List[int]] = []
    agent_id: Optional[int] = None
    subtasks: Optional[List[SubtaskInput]] = None


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
    correlation_id: Optional[str] = None
    parent_id: Optional[int] = None
    position: Optional[int] = None
    assignee_ids: Optional[List[int]] = None
    dependency_ids: Optional[List[int]] = None
    agent_id: Optional[int] = None
    subtasks: Optional[List[SubtaskInput]] = None


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
    agent_id: Optional[int] = None
    agent: Optional["AgentBrief"] = None

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


# ============ Agent Schemas ============
class AgentRegister(BaseModel):
    name: str = Field(..., max_length=255)
    agent_type: AgentType
    capabilities: List[str] = Field(default=[])
    session_id: Optional[str] = Field(default=None, max_length=255)
    metadata: Optional[dict[str, Any]] = None


class AgentHeartbeat(BaseModel):
    status: Optional[AgentStatus] = None
    current_task_id: Optional[int] = None
    message: Optional[str] = None


class AgentResponse(BaseModel):
    id: int
    name: str
    agent_type: AgentType
    status: AgentStatus
    capabilities: List[str] = []
    session_id: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    current_task_id: Optional[int] = None
    current_task: Optional[TaskBrief] = None
    is_alive: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class AgentBrief(BaseModel):
    id: int
    name: str
    agent_type: AgentType
    status: AgentStatus
    is_alive: bool = True

    class Config:
        from_attributes = True


class AgentRegistered(BaseModel):
    id: int
    name: str
    api_key: str


class AgentActionCreate(BaseModel):
    action_type: str = Field(..., max_length=50)
    summary: str = Field(..., max_length=500)
    detail: Optional[str] = None
    task_id: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class AgentActionResponse(BaseModel):
    id: int
    agent_id: int
    agent_name: Optional[str] = None
    agent_type: Optional[AgentType] = None
    action_type: str
    summary: str
    detail: Optional[str] = None
    task_id: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GitHubLinkCreate(BaseModel):
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    github_repo: str
    github_type: str
    github_id: str
    github_url: str
    title: Optional[str] = None
    state: Optional[str] = "open"


class GitHubLinkResponse(BaseModel):
    id: int
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    github_repo: str
    github_type: str
    github_id: str
    github_url: str
    title: Optional[str] = None
    state: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrchestratorStatus(BaseModel):
    active_agents: int
    max_agents: int
    queue_depth: int
    agents: List[AgentBrief] = []


# ============ Agent Message Schemas ============
class AgentMessageCreate(BaseModel):
    recipient_id: int
    message_type: str = Field(default="request", max_length=50)  # request, response, broadcast, info
    subject: str = Field(..., max_length=255)
    body: Optional[str] = None
    thread_id: Optional[str] = Field(default=None, max_length=255)
    in_reply_to: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None


class AgentMessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: Optional[str] = None
    recipient_id: int
    recipient_name: Optional[str] = None
    thread_id: Optional[str] = None
    message_type: str
    subject: str
    body: Optional[str] = None
    status: MessageStatus
    in_reply_to: Optional[int] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Agent Directive Schemas ============
class AgentDirectiveCreate(BaseModel):
    directive_type: DirectiveType
    payload: Optional[dict[str, Any]] = None


class AgentDirectiveResponse(BaseModel):
    id: int
    agent_id: int
    directive_type: DirectiveType
    payload: Optional[dict[str, Any]] = None
    issued_by: Optional[int] = None
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Task Queue Schemas ============
class TaskClaimRequest(BaseModel):
    required_capabilities: Optional[List[str]] = None
    project_id: Optional[int] = None
    priorities: Optional[List[TaskPriority]] = None


class TaskQueueItem(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    project_id: int
    project_name: Optional[str] = None
    required_capabilities: List[str] = []
    estimated_hours: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Hook Schemas ============
class ToolActionHookEvent(BaseModel):
    """Schema for Claude Code PostToolUse HTTP hook events."""
    session_id: str
    tool_name: str
    tool_input: Optional[Any] = None


# Resolve forward references (TaskResponse uses AgentBrief which is defined later)
TaskResponse.model_rebuild()
