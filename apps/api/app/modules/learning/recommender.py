"""
Learning Recommender — 个性化学习推荐引擎

Simple rule-based recommendation system:
1. Identify weak dimensions from recent performance
2. Match with knowledge items in those dimensions
3. Suggest practice profiles that target weak areas
4. Generate contextual tips
"""

from typing import Optional
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import PerformanceRecord, UserStats, LearningRecommendation
from app.models.knowledge import KnowledgeItem
from app.models.seeker import SeekerProfile


class LearningRecommender:
    """Rule-based learning recommendation engine."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def generate_recommendations(
        self,
        user_id: str,
        max_recommendations: int = 5,
    ) -> list[dict]:
        """Generate personalized learning recommendations based on recent performance."""
        
        # 1. Get recent performance records
        stmt = (
            select(PerformanceRecord)
            .where(PerformanceRecord.user_id == user_id)
            .order_by(PerformanceRecord.created_at.desc())
            .limit(10)
        )
        result = await self.session.execute(stmt)
        records = result.scalars().all()
        
        if not records:
            return await self._generate_starter_recommendations(user_id)
        
        # 2. Identify weak dimensions
        dimension_scores: dict[str, list[float]] = {}
        mistake_types: dict[str, int] = {}
        
        for record in records:
            for dim, score in record.dimension_scores.items():
                dimension_scores.setdefault(dim, []).append(score)
            for mistake in record.mistakes:
                m_type = mistake.get("type", "unknown")
                mistake_types[m_type] = mistake_types.get(m_type, 0) + 1
        
        # Calculate averages and find weak dimensions
        dim_averages = {
            dim: sum(scores) / len(scores)
            for dim, scores in dimension_scores.items()
        }
        
        weak_dims = sorted(dim_averages.items(), key=lambda x: x[1])[:3]
        
        recommendations = []
        
        # 3. Recommend knowledge items for weak dimensions
        for dim, avg_score in weak_dims:
            difficulty = "beginner" if avg_score < 40 else "intermediate" if avg_score < 70 else "advanced"
            
            stmt = (
                select(KnowledgeItem)
                .where(KnowledgeItem.difficulty == difficulty)
                .limit(2)
            )
            result = await self.session.execute(stmt)
            items = result.scalars().all()
            
            for item in items:
                recommendations.append({
                    "title": f"学习: {item.title}",
                    "description": item.summary or item.title,
                    "recommendation_type": "knowledge",
                    "priority": 8 if avg_score < 40 else 5,
                    "reason": f"你在「{dim}」维度的近期平均分为{avg_score:.0f}，建议加强学习。",
                    "knowledge_item_id": item.id,
                })
        
        # 4. Recommend practice based on common mistakes
        if mistake_types:
            top_mistake = max(mistake_types, key=mistake_types.get)
            recommendations.append({
                "title": f"针对性练习: {top_mistake}",
                "description": f"你在「{top_mistake}」方面出现了{mistake_types[top_mistake]}次失误，建议进行专项练习。",
                "recommendation_type": "practice",
                "priority": 7,
                "reason": f"近期频繁出现的问题类型",
            })
        
        return recommendations[:max_recommendations]
    
    async def _generate_starter_recommendations(self, user_id: str) -> list[dict]:
        """Generate recommendations for new users with no history."""
        return [
            {
                "title": "从初次访谈开始",
                "description": "学习初次访谈的结构化流程，这是所有咨询的基础。",
                "recommendation_type": "knowledge",
                "priority": 10,
                "reason": "推荐新手从基础技能开始学习。",
            },
            {
                "title": "进行第一次模拟练习",
                "description": "选择一个初级难度的来访者档案，进行你的第一次模拟咨询。",
                "recommendation_type": "practice",
                "priority": 9,
                "reason": "实践是最好的学习方式。",
            },
            {
                "title": "学习共情技巧",
                "description": "共情是心理咨询最核心的能力之一，掌握共情技巧是成为优秀咨询师的基础。",
                "recommendation_type": "knowledge",
                "priority": 8,
                "reason": "共情能力是咨询的基石。",
            },
        ]
    
    async def update_user_stats(self, user_id: str) -> UserStats:
        """Recalculate and update user statistics."""
        from sqlalchemy import func
        from app.models.session import CounselingSession
        
        # Get all performance records
        stmt = (
            select(PerformanceRecord)
            .where(PerformanceRecord.user_id == user_id)
            .order_by(PerformanceRecord.created_at.desc())
        )
        result = await self.session.execute(stmt)
        records = list(result.scalars().all())
        
        # Count sessions
        session_stmt = (
            select(func.count())
            .select_from(CounselingSession)
            .where(CounselingSession.user_id == user_id)
        )
        session_count = (await self.session.execute(session_stmt)).scalar() or 0
        
        # Calculate stats
        total_sessions = session_count
        scores = [r.overall_score for r in records if r.overall_score]
        average_score = sum(scores) / len(scores) if scores else 0
        
        # Dimension averages
        dim_totals: dict[str, list[float]] = {}
        for r in records:
            for dim, score in r.dimension_scores.items():
                dim_totals.setdefault(dim, []).append(score)
        dim_averages = {d: sum(s)/len(s) for d, s in dim_totals.items()}
        
        # Recent scores
        recent = [
            {"score": r.overall_score, "date": r.created_at.isoformat()}
            for r in records[:10]
        ]
        
        # Weak dimensions
        weak = sorted(dim_averages.items(), key=lambda x: x[1])[:3]
        
        # Common mistakes
        mistake_counter: dict[str, int] = {}
        for r in records[:20]:
            for m in r.mistakes:
                mt = m.get("type", "unknown")
                mistake_counter[mt] = mistake_counter.get(mt, 0) + 1
        common_mistakes = sorted(mistake_counter.items(), key=lambda x: -x[1])[:5]
        
        # Upsert stats
        stats_stmt = select(UserStats).where(UserStats.user_id == user_id)
        existing = (await self.session.execute(stats_stmt)).scalars().first()
        
        if existing:
            existing.total_sessions = total_sessions
            existing.average_score = average_score
            existing.dimension_averages = dim_averages
            existing.recent_scores = recent
            existing.weak_dimensions = [{"dim": d, "avg": s} for d, s in weak]
            existing.common_mistakes = [{"type": t, "count": c} for t, c in common_mistakes]
            stats = existing
        else:
            stats = UserStats(
                user_id=user_id,
                total_sessions=total_sessions,
                average_score=average_score,
                dimension_averages=dim_averages,
                recent_scores=recent,
                weak_dimensions=[{"dim": d, "avg": s} for d, s in weak],
                common_mistakes=[{"type": t, "count": c} for t, c in common_mistakes],
            )
            self.session.add(stats)
        
        await self.session.commit()
        return stats
