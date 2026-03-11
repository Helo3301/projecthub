from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


# Association tables
task_assignees = Table(
    'task_assignees',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)

task_dependencies = Table(
    'task_dependencies',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE')),
    Column('depends_on_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
)


class TaskStatus(enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class TaskPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class AgentType(enum.Enum):
    CLAUDE_CODE = "claude_code"
    TINY_MIND = "tiny_mind"
    HESTIA = "hestia"
    CUSTOM = "custom"


class AgentStatus(enum.Enum):
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    ERROR = "error"
    OFFLINE = "offline"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    avatar_color = Column(String(7), default="#4F46E5")  # Hex color
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owned_projects = relationship("Project", back_populates="owner")
    assigned_tasks = relationship("Task", secondary=task_assignees, back_populates="assignees")
    reminders = relationship("Reminder", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(7), default="#4F46E5")  # Hex color for project
    icon = Column(String(50), default="folder")
    owner_id = Column(Integer, ForeignKey("users.id"))
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.BACKLOG)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.MEDIUM)
    color = Column(String(7))  # Custom color override

    # Dates for Gantt
    start_date = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Hierarchy
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    parent_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))  # For subtasks
    position = Column(Integer, default=0)  # Order within column/parent

    # Metadata
    estimated_hours = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Agent assignment
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    parent = relationship("Task", remote_side=[id], backref="subtasks")
    assignees = relationship("User", secondary=task_assignees, back_populates="assigned_tasks")
    dependencies = relationship(
        "Task",
        secondary=task_dependencies,
        primaryjoin=id == task_dependencies.c.task_id,
        secondaryjoin=id == task_dependencies.c.depends_on_id,
        backref="dependents"
    )
    reminders = relationship("Reminder", back_populates="task", cascade="all, delete-orphan")
    agent = relationship("Agent", back_populates="assigned_tasks", foreign_keys=[agent_id])


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    remind_at = Column(DateTime(timezone=True), nullable=False)
    message = Column(String(500))
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    task = relationship("Task", back_populates="reminders")
    user = relationship("User", back_populates="reminders")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    agent_type = Column(SQLEnum(AgentType), nullable=False)
    status = Column(SQLEnum(AgentStatus), default=AgentStatus.IDLE)
    capabilities = Column(Text, default="[]")  # JSON list
    session_id = Column(String(255), unique=True, index=True)
    api_key = Column(String(255), unique=True, index=True, nullable=False)
    metadata_json = Column(Text)  # Agent-specific data (PID, path, etc.)
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    current_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    current_task = relationship("Task", foreign_keys=[current_task_id])
    assigned_tasks = relationship("Task", back_populates="agent", foreign_keys="Task.agent_id")
    actions = relationship("AgentAction", back_populates="agent", cascade="all, delete-orphan",
                           order_by="AgentAction.created_at.desc()")


class AgentAction(Base):
    __tablename__ = "agent_actions"
    __table_args__ = (
        Index("ix_agent_actions_agent_created", "agent_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False)  # tool_call, tool_result, decision, status_change, error, github_push, github_pr, task_update
    summary = Column(String(500), nullable=False)
    detail = Column(Text)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    metadata_json = Column(Text)  # Structured data for the action
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="actions")
    task = relationship("Task")


class GitHubLink(Base):
    __tablename__ = "github_links"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    github_repo = Column(String(255), nullable=False)
    github_type = Column(String(20), nullable=False)  # issue, pull_request, commit
    github_id = Column(String(100), nullable=False)
    github_url = Column(String(500), nullable=False)
    title = Column(String(500))
    state = Column(String(20), default="open")  # open, closed, merged
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    task = relationship("Task")
    project = relationship("Project")
