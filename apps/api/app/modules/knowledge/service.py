"""
Knowledge Service — 三维知识库服务层

Handles CRUD, semantic search, and knowledge ingestion.
"""

from typing import Optional
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeItem, SCHOOL_OPTIONS, ISSUE_OPTIONS, DIFFICULTY_LEVELS
from app.core.llm import get_llm_client, get_settings


class KnowledgeService:
    """Service layer for the 3D knowledge base."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def search(
        self,
        query: Optional[str] = None,
        school: Optional[str] = None,
        issue: Optional[str] = None,
        difficulty: Optional[str] = None,
        source_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[KnowledgeItem], int]:
        """Search knowledge items with filtering and optional semantic search."""
        stmt = select(KnowledgeItem)
        
        if school:
            stmt = stmt.where(KnowledgeItem.school == school)
        if issue:
            stmt = stmt.where(KnowledgeItem.issue == issue)
        if difficulty:
            stmt = stmt.where(KnowledgeItem.difficulty == difficulty)
        if source_type:
            stmt = stmt.where(KnowledgeItem.source_type == source_type)
        
        # TODO: Add vector semantic search when query is provided
        # For now, use text matching
        if query:
            stmt = stmt.where(
                col(KnowledgeItem.title).contains(query)
                | col(KnowledgeItem.content).contains(query)
            )
        
        # Count total
        from sqlalchemy import func
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar() or 0
        
        # Paginate
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(stmt)
        items = result.scalars().all()
        
        return list(items), total
    
    async def get_by_id(self, item_id: str) -> Optional[KnowledgeItem]:
        return await self.session.get(KnowledgeItem, item_id)
    
    async def create(self, item: KnowledgeItem) -> KnowledgeItem:
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item
    
    async def get_dimensions(self) -> dict:
        """Return available dimension options."""
        return {
            "schools": SCHOOL_OPTIONS,
            "issues": ISSUE_OPTIONS,
            "difficulties": DIFFICULTY_LEVELS,
        }
    
    async def get_stats(self) -> dict:
        """Return knowledge base statistics by dimension."""
        from sqlalchemy import func
        
        # Count by school
        school_stmt = select(KnowledgeItem.school, func.count()).group_by(KnowledgeItem.school)
        school_result = await self.session.execute(school_stmt)
        schools = {row[0]: row[1] for row in school_result.all()}
        
        # Count by issue
        issue_stmt = select(KnowledgeItem.issue, func.count()).group_by(KnowledgeItem.issue)
        issue_result = await self.session.execute(issue_stmt)
        issues = {row[0]: row[1] for row in issue_result.all()}
        
        # Count by difficulty
        diff_stmt = select(KnowledgeItem.difficulty, func.count()).group_by(KnowledgeItem.difficulty)
        diff_result = await self.session.execute(diff_stmt)
        difficulties = {row[0]: row[1] for row in diff_result.all()}
        
        total_stmt = select(func.count()).select_from(KnowledgeItem)
        total_result = await self.session.execute(total_stmt)
        total = total_result.scalar() or 0
        
        return {
            "total": total,
            "by_school": schools,
            "by_issue": issues,
            "by_difficulty": difficulties,
        }
