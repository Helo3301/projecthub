from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from app.database import engine, Base
from app.routers import auth, projects, tasks, users, calendar, integrations, agents, coordination, runner, agent_tasks
from app.config import get_settings

settings = get_settings()

# Create tables
Base.metadata.create_all(bind=engine)

# Additive migrations — safe to run multiple times.
with engine.connect() as conn:
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("tasks")]
    if "correlation_id" not in columns:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN correlation_id VARCHAR(255)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tasks_correlation_id ON tasks(correlation_id)"))
        conn.commit()

app = FastAPI(
    title="ProjectHub API",
    description="Project Management System API",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
from app.routers import auth, projects, tasks, users, calendar, integrations, agents, coordination, runner, agent_tasks


@app.get("/")
def root():
    return {"message": "ProjectHub API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
