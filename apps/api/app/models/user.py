"""MindBridge - Database Models: User & Auth."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text


class User(SQLModel, table=True):
    """心理辅导员用户。"""
    __tablename__ = "users"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    username: str = Field(unique=True, index=True, max_length=100)
    display_name: str = Field(max_length=100)
    hashed_password: str = Field(max_length=255)
    
    # Profile
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    bio: Optional[str] = Field(default=None, sa_column=Column(Text))
    experience_level: str = Field(default="beginner", max_length=50)  # beginner / intermediate / advanced
    specialization: Optional[str] = Field(default=None, max_length=255)  # 擅长方向
    
    # Metadata
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login_at: Optional[datetime] = Field(default=None)
