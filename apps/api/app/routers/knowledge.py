"""MindBridge API - Knowledge Router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user_id
from app.schemas.knowledge import (
    KnowledgeItemResponse, KnowledgeSearchRequest, KnowledgeSearchResponse,
    KnowledgeDimensionResponse,
)
from app.modules.knowledge.service import KnowledgeService

router = APIRouter(prefix="/knowledge", tags=["三维知识库"])


@router.get("/dimensions", response_model=KnowledgeDimensionResponse)
async def get_dimensions(session: AsyncSession = Depends(get_session)):
    """获取知识库三维维度选项。"""
    svc = KnowledgeService(session)
    dims = await svc.get_dimensions()
    return KnowledgeDimensionResponse(**dims)


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    data: KnowledgeSearchRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """搜索知识库条目（支持三维筛选和文本搜索）。"""
    svc = KnowledgeService(session)
    items, total = await svc.search(
        query=data.query,
        school=data.school,
        issue=data.issue,
        difficulty=data.difficulty,
        source_type=data.source_type,
        page=data.page,
        page_size=data.page_size,
    )
    return KnowledgeSearchResponse(
        items=[KnowledgeItemResponse(
            id=item.id,
            school=item.school,
            issue=item.issue,
            difficulty=item.difficulty,
            title=item.title,
            content=item.content,
            summary=item.summary,
            source_type=item.source_type,
            source_ref=item.source_ref,
            tags=item.tags or [],
        ) for item in items],
        total=total,
        page=data.page,
        page_size=data.page_size,
    )


@router.get("/stats/overview")
async def get_knowledge_stats(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取知识库统计信息。"""
    svc = KnowledgeService(session)
    return await svc.get_stats()


@router.get("/{item_id}", response_model=KnowledgeItemResponse)
async def get_knowledge_item(
    item_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取单个知识库条目。"""
    svc = KnowledgeService(session)
    item = await svc.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    return KnowledgeItemResponse(
        id=item.id,
        school=item.school,
        issue=item.issue,
        difficulty=item.difficulty,
        title=item.title,
        content=item.content,
        summary=item.summary,
        source_type=item.source_type,
        source_ref=item.source_ref,
        tags=item.tags or [],
    )
