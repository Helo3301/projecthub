from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserUpdate, UserBrief
from app.auth import get_current_user, get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=List[UserBrief])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users (for assignment dropdowns)"""
    users = db.query(User).filter(User.is_active == True).all()
    return [UserBrief(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        avatar_color=u.avatar_color
    ) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_data = user_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user (any authenticated user can add team members)"""
    # Check if user exists
    existing_user = db.query(User).filter(
        (User.email == user_data.get("email")) |
        (User.username == user_data.get("username"))
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email or username already registered"
        )

    # Create user
    hashed_password = get_password_hash(user_data.get("password"))
    db_user = User(
        email=user_data.get("email"),
        username=user_data.get("username"),
        full_name=user_data.get("full_name"),
        avatar_color=user_data.get("avatar_color", "#4F46E5"),
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
