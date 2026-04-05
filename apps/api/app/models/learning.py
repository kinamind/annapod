"""annapod - Database Models: Learning Path & Performance."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, JSON


class PerformanceRecord(SQLModel, table=True):
    """单次 session 的表现评估记录。"""

    __tablename__ = "performance_records"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    session_id: str = Field(foreign_key="counseling_sessions.id", index=True)

    # Overall score (0-100)
    overall_score: float = Field(default=0.0)

    # Dimension scores (JSON: {dimension_key: score})
    dimension_scores: dict = Field(default_factory=dict, sa_column=Column(JSON))
    # Example dimensions:
    # - empathy (共情能力)
    # - active_listening (积极倾听)
    # - questioning (提问技巧)
    # - reflection (情感反映)
    # - confrontation (面质技术)
    # - goal_setting (目标设定)
    # - crisis_handling (危机处理)
    # - theoretical_application (理论应用)

    # Mistakes / areas for improvement
    mistakes: list = Field(default_factory=list, sa_column=Column(JSON))
    # [{type, description, severity, suggestion, conversation_turn}]

    # Strengths
    strengths: list = Field(default_factory=list, sa_column=Column(JSON))

    # Detailed feedback
    feedback: str = Field(default="", sa_column=Column(Text))
    tips: list = Field(default_factory=list, sa_column=Column(JSON))

    # Context
    difficulty: str = Field(default="intermediate", max_length=50)
    issue_type: Optional[str] = Field(default=None, max_length=100)
    school_type: Optional[str] = Field(default=None, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class LearningRecommendation(SQLModel, table=True):
    """个性化学习推荐。"""

    __tablename__ = "learning_recommendations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)

    # Recommendation content
    title: str = Field(max_length=200)
    description: str = Field(sa_column=Column(Text))
    recommendation_type: str = Field(max_length=50)  # knowledge / practice / review

    # Link to knowledge or practice
    knowledge_item_id: Optional[str] = Field(default=None, foreign_key="knowledge_items.id")
    profile_id: Optional[str] = Field(default=None, foreign_key="seeker_profiles.id")

    # Priority and reason
    priority: int = Field(default=5)  # 1-10, higher = more urgent
    reason: str = Field(default="", sa_column=Column(Text))

    # Status
    is_read: bool = Field(default=False)
    is_completed: bool = Field(default=False)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class UserStats(SQLModel, table=True):
    """用户统计数据快照（定期更新）。"""

    __tablename__ = "user_stats"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)

    # Aggregate stats
    total_sessions: int = Field(default=0)
    total_practice_hours: float = Field(default=0.0)
    average_score: float = Field(default=0.0)

    # Dimension averages
    dimension_averages: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Recent trend (last 10 sessions)
    recent_scores: list = Field(default_factory=list, sa_column=Column(JSON))

    # Weak areas (for recommendation)
    weak_dimensions: list = Field(default_factory=list, sa_column=Column(JSON))
    weak_issues: list = Field(default_factory=list, sa_column=Column(JSON))

    # Mistake patterns
    common_mistakes: list = Field(default_factory=list, sa_column=Column(JSON))

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
