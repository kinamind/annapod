"""annapod API - Learning Path Router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user_id
from app.models.learning import PerformanceRecord, UserStats, LearningRecommendation
from app.models.session import CounselingSession
from app.schemas.learning import (
    PerformanceRecordResponse,
    DashboardResponse,
    GrowthCurveResponse,
    MistakeBookResponse,
    RecommendationResponse,
)
from app.modules.learning.recommender import LearningRecommender
from app.modules.learning.evaluator import EVALUATION_DIMENSIONS

router = APIRouter(prefix="/learning", tags=["个性化学习路径"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取学习仪表盘数据。"""
    # Get or create user stats
    recommender = LearningRecommender(session)
    stats = await recommender.update_user_stats(user_id)

    # Get recommendations
    recommendations = await recommender.generate_recommendations(user_id, max_recommendations=5)

    # Build growth curve
    stmt = (
        select(PerformanceRecord)
        .where(PerformanceRecord.user_id == user_id)
        .order_by(PerformanceRecord.created_at.asc())
    )
    result = await session.execute(stmt)
    records = result.scalars().all()

    growth_curve = [{"date": r.created_at.isoformat(), "score": r.overall_score} for r in records]

    return DashboardResponse(
        total_sessions=stats.total_sessions,
        total_practice_hours=stats.total_practice_hours,
        average_score=stats.average_score,
        dimension_averages=stats.dimension_averages,
        recent_scores=stats.recent_scores,
        growth_curve=growth_curve,
        weak_dimensions=stats.weak_dimensions,
        common_mistakes=stats.common_mistakes,
        recommendations=recommendations,
    )


@router.get("/growth-curve", response_model=GrowthCurveResponse)
async def get_growth_curve(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取成长曲线数据。"""
    stmt = (
        select(PerformanceRecord)
        .where(PerformanceRecord.user_id == user_id)
        .order_by(PerformanceRecord.created_at.asc())
    )
    result = await session.execute(stmt)
    records = list(result.scalars().all())

    data_points = [
        {
            "date": r.created_at.isoformat(),
            "overall_score": r.overall_score,
            "dimension_scores": r.dimension_scores,
        }
        for r in records
    ]

    # Determine trend
    if len(records) < 3:
        trend = "stable"
    else:
        recent = [r.overall_score for r in records[-5:]]
        earlier = [r.overall_score for r in records[-10:-5]] or [r.overall_score for r in records[:5]]
        avg_recent = sum(recent) / len(recent)
        avg_earlier = sum(earlier) / len(earlier) if earlier else avg_recent
        if avg_recent > avg_earlier + 5:
            trend = "improving"
        elif avg_recent < avg_earlier - 5:
            trend = "declining"
        else:
            trend = "stable"

    return GrowthCurveResponse(data_points=data_points, trend=trend)


@router.get("/mistakes", response_model=MistakeBookResponse)
async def get_mistake_book(
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取错题集/失误记录。"""
    stmt = (
        select(PerformanceRecord)
        .where(PerformanceRecord.user_id == user_id)
        .order_by(PerformanceRecord.created_at.desc())
    )
    result = await session.execute(stmt)
    records = result.scalars().all()

    # Aggregate mistakes
    all_mistakes: dict[str, dict] = {}
    for record in records:
        for mistake in record.mistakes:
            m_key = f"{mistake.get('type', 'unknown')}:{mistake.get('description', '')[:50]}"
            if m_key not in all_mistakes:
                all_mistakes[m_key] = {
                    "id": m_key,
                    "type": mistake.get("type", "unknown"),
                    "description": mistake.get("description", ""),
                    "frequency": 0,
                    "severity": mistake.get("severity", "medium"),
                    "recent_session": record.session_id,
                    "suggestion": mistake.get("suggestion", ""),
                }
            all_mistakes[m_key]["frequency"] += 1

    mistakes = sorted(all_mistakes.values(), key=lambda x: -x["frequency"])
    total = len(mistakes)
    paginated = mistakes[(page - 1) * page_size : page * page_size]

    return MistakeBookResponse(
        mistakes=paginated,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/recommendations")
async def get_recommendations(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取个性化学习推荐。"""
    recommender = LearningRecommender(session)
    return await recommender.generate_recommendations(user_id)


@router.get("/dimensions")
async def get_evaluation_dimensions():
    """获取评估维度定义。"""
    return EVALUATION_DIMENSIONS


@router.get("/sessions/{session_id}/evaluation", response_model=PerformanceRecordResponse)
async def get_session_evaluation(
    session_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取特定 session 的评估结果。"""
    stmt = select(PerformanceRecord).where(
        PerformanceRecord.session_id == session_id,
        PerformanceRecord.user_id == user_id,
    )
    result = await session.execute(stmt)
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="评估记录不存在")
    return record
