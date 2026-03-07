"""MindBridge - Database Models: Knowledge Base (3D)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON
from pgvector.sqlalchemy import Vector


class KnowledgeItem(SQLModel, table=True):
    """三维知识库条目。"""
    __tablename__ = "knowledge_items"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    
    # 三维标签
    school: str = Field(index=True, max_length=100)  # 流派: CBT, 精神分析, 人本主义, 家庭治疗, etc.
    issue: str = Field(index=True, max_length=100)   # 症状/议题: 抑郁, 焦虑, 亲密关系, etc.
    difficulty: str = Field(index=True, max_length=50)  # 难度: beginner / intermediate / advanced
    
    # Content
    title: str = Field(max_length=300)
    content: str = Field(sa_column=Column(Text))
    summary: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    # Source
    source_type: str = Field(max_length=50)  # textbook / paper / guideline / case / technique
    source_ref: Optional[str] = Field(default=None, max_length=500)  # URL or citation
    
    # Tags and metadata
    tags: list = Field(default_factory=list, sa_column=Column(JSON))
    metadata: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    # Vector embedding for semantic search
    embedding: Optional[list[float]] = Field(
        default=None,
        sa_column=Column(Vector(768))  # Gemini embedding dimension
    )
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Enumeration constants for the 3D knowledge dimensions
SCHOOL_OPTIONS = [
    "CBT（认知行为疗法）",
    "精神分析/精神动力学",
    "人本主义/人格中心",
    "家庭治疗/系统治疗",
    "接纳承诺疗法（ACT）",
    "正念疗法",
    "焦点解决短程治疗（SFBT）",
    "叙事疗法",
    "格式塔/完形疗法",
    "整合取向",
]

ISSUE_OPTIONS = [
    "抑郁",
    "焦虑",
    "创伤与PTSD",
    "亲密关系",
    "家庭冲突",
    "青少年成长",
    "职场压力",
    "自我认同",
    "丧失与哀伤",
    "成瘾行为",
    "进食障碍",
    "睡眠障碍",
    "躯体化症状",
    "危机干预",
]

DIFFICULTY_LEVELS = [
    {"key": "beginner", "label": "初级", "description": "初次访谈、建立关系、基本倾听与共情"},
    {"key": "intermediate", "label": "中级", "description": "阻抗处理、情感反映、认知重构"},
    {"key": "advanced", "label": "高级", "description": "危机干预、深层洞察、移情与反移情处理"},
]
