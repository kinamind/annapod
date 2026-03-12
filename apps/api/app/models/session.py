"""MindBridge - Database Models: Counseling Sessions."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class CounselingSession(SQLModel, table=True):
    """单次咨询 session。"""
    __tablename__ = "counseling_sessions"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    profile_id: str = Field(foreign_key="seeker_profiles.id", index=True)
    cache_id: Optional[str] = Field(default=None, foreign_key="seeker_profile_caches.id")
    
    # Session config
    has_long_term_memory: bool = Field(default=True)
    session_number: int = Field(default=1)  # 第几次 session（多 session 长期记忆模式）
    parent_session_id: Optional[str] = Field(default=None, index=True)  # 关联的上一次 session
    
    # Conversation data
    messages: list = Field(default_factory=list, sa_column=Column(JSON))  # [{role, content, timestamp}]
    
    # AnnaAgent runtime state (for resume)
    chain_index: int = Field(default=1)
    runtime_state: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    # Status
    status: str = Field(default="active", max_length=20)  # active / completed / abandoned
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    ended_at: Optional[datetime] = Field(default=None)
    duration_seconds: Optional[int] = Field(default=None)
    
    # Evaluation (filled after session ends)
    evaluation: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    score: Optional[float] = Field(default=None)


class SessionGroup(SQLModel, table=True):
    """多 session 组（长期记忆模式下，多次 session 属于同一组）。"""
    __tablename__ = "session_groups"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    profile_id: str = Field(foreign_key="seeker_profiles.id", index=True)
    
    title: str = Field(default="", max_length=200)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    session_count: int = Field(default=0)
    
    status: str = Field(default="active", max_length=20)  # active / completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
