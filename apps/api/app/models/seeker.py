"""MindBridge - Database Models: Seeker Profiles (Virtual Clients)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class SeekerProfile(SQLModel, table=True):
    """虚拟来访者档案，对应 AnnaAgent 的 portrait + report + conversation。"""
    __tablename__ = "seeker_profiles"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    
    # Portrait 人口学与心理特征
    age: str = Field(max_length=10)
    gender: str = Field(max_length=10)
    occupation: str = Field(max_length=100)
    marital_status: str = Field(max_length=50)
    symptoms: str = Field(sa_column=Column(Text))  # semicolon-separated
    
    # Categorization 分组标签
    group_tag: str = Field(index=True, max_length=50)  # elderly / adolescent / college / female / general
    difficulty: str = Field(default="intermediate", max_length=50)  # beginner / intermediate / advanced
    issue_tags: Optional[str] = Field(default=None, sa_column=Column(Text))  # comma-separated issue labels
    
    # Source data (JSON blobs from Anna-CPsyCounD)
    report: dict = Field(default_factory=dict, sa_column=Column(JSON))
    conversation: list = Field(default_factory=list, sa_column=Column(JSON))
    portrait_raw: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    # Metadata
    source_id: Optional[str] = Field(default=None, max_length=100)  # original dataset ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SeekerProfileCache(SQLModel, table=True):
    """缓存已初始化的来访者配置（system prompt, complaint chain 等），避免重复生成。"""
    __tablename__ = "seeker_profile_caches"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    profile_id: str = Field(foreign_key="seeker_profiles.id", index=True)
    
    # Cached AnnaAgent initialization results
    system_prompt: str = Field(sa_column=Column(Text))
    complaint_chain: list = Field(default_factory=list, sa_column=Column(JSON))
    style: list = Field(default_factory=list, sa_column=Column(JSON))
    situation: str = Field(default="", sa_column=Column(Text))
    status: str = Field(default="", sa_column=Column(Text))
    event: str = Field(default="", sa_column=Column(Text))
    scales: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    # Memory toggle state
    has_long_term_memory: bool = Field(default=True)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    used_count: int = Field(default=0)
