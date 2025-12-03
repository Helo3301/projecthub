from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Project, Task, User, TaskStatus
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Project).filter(Project.owner_id == current_user.id)
    if not include_archived:
        query = query.filter(Project.is_archived == False)

    projects = query.all()

    # Add task counts
    result = []
    for project in projects:
        task_count = db.query(Task).filter(Task.project_id == project.id, Task.parent_id == None).count()
        completed_count = db.query(Task).filter(
            Task.project_id == project.id,
            Task.parent_id == None,
            Task.status == TaskStatus.DONE
        ).count()

        project_dict = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "color": project.color,
            "icon": project.icon,
            "owner_id": project.owner_id,
            "is_archived": project.is_archived,
            "created_at": project.created_at,
            "task_count": task_count,
            "completed_count": completed_count,
        }
        result.append(ProjectResponse(**project_dict))

    return result


@router.post("/", response_model=ProjectResponse)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_project = Project(
        **project_data.model_dump(),
        owner_id=current_user.id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_count = db.query(Task).filter(Task.project_id == project.id, Task.parent_id == None).count()
    completed_count = db.query(Task).filter(
        Task.project_id == project.id,
        Task.parent_id == None,
        Task.status == TaskStatus.DONE
    ).count()

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        icon=project.icon,
        owner_id=project.owner_id,
        is_archived=project.is_archived,
        created_at=project.created_at,
        task_count=task_count,
        completed_count=completed_count,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}
