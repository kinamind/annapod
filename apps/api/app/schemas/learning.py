"""annapod - API Schemas: Learning Path & Performance."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PerformanceRecordResponse(BaseModel):
    id: str
    session_id: str
    overall_score: float
    dimension_scores: dict
    mistakes: list
    strengths: list
    feedback: str
    tips: list
    difficulty: str
    issue_type: Optional[str] = None
    created_at: datetime


class DashboardResponse(BaseModel):
    """用户仪表盘。"""

    total_sessions: int
    total_practice_hours: float
    average_score: float
    dimension_averages: dict
    recent_scores: list  # [{session_id, score, date}]
    growth_curve: list  # [{date, score}]
    weak_dimensions: list
    common_mistakes: list
    recommendations: list  # top 5 recommendations


class GrowthCurveResponse(BaseModel):
    """成长曲线数据。"""

    data_points: list  # [{date, overall_score, dimension_scores}]
    trend: str  # improving / stable / declining


class MistakeBookResponse(BaseModel):
    """错题集。"""

    mistakes: list  # [{id, type, description, frequency, severity, recent_session, suggestion}]
    total: int
    page: int
    page_size: int


class RecommendationResponse(BaseModel):
    id: str
    title: str
    description: str
    recommendation_type: str
    priority: int
    reason: str
    knowledge_item_id: Optional[str] = None
    profile_id: Optional[str] = None
    is_read: bool
    is_completed: bool
    created_at: datetime
