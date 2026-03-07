"""MindBridge API - Simulator Router (Virtual Client)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_session
from app.core.security import get_current_user_id
from app.models.seeker import SeekerProfile, SeekerProfileCache
from app.models.session import CounselingSession, SessionGroup
from app.schemas.simulator import (
    SeekerProfileResponse, SeekerProfileListResponse,
    StartSessionRequest, StartSessionResponse,
    ChatRequest, ChatResponse,
    EndSessionRequest, EndSessionResponse,
    SessionGroupResponse,
)
from app.modules.simulator.engine import SimulatorEngine
from app.modules.simulator.profile_manager import ProfileManager
from app.modules.learning.evaluator import evaluate_session

router = APIRouter(prefix="/simulator", tags=["虚拟来访者模拟"])

# In-memory engine registry (for active sessions)
# In production, consider Redis for horizontal scaling
_active_engines: dict[str, SimulatorEngine] = {}


@router.get("/profiles", response_model=SeekerProfileListResponse)
async def list_profiles(
    group: str | None = None,
    difficulty: str | None = None,
    page: int = 1,
    page_size: int = 20,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取来访者档案列表，支持按群体和难度筛选。"""
    stmt = select(SeekerProfile)
    if group:
        stmt = stmt.where(SeekerProfile.group_tag == group)
    if difficulty:
        stmt = stmt.where(SeekerProfile.difficulty == difficulty)
    
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0
    
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(stmt)
    profiles = result.scalars().all()
    
    return SeekerProfileListResponse(
        profiles=[SeekerProfileResponse(**p.__dict__) for p in profiles],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/profiles/groups")
async def list_groups():
    """获取来访者分组选项（银发、青少年、大学生、女性等）。"""
    return ProfileManager.get_group_options()


@router.post("/sessions/start", response_model=StartSessionResponse)
async def start_session(
    data: StartSessionRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """开始一个新的咨询 session。"""
    # Load profile
    profile = await session.get(SeekerProfile, data.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="来访者档案不存在")
    
    portrait = {
        "age": profile.age,
        "gender": profile.gender,
        "occupation": profile.occupation,
        "marital_status": profile.marital_status,
        "symptoms": profile.symptoms,
    }
    
    # Handle session group for multi-session mode
    session_group_id = data.session_group_id
    session_number = 1
    previous_conversations = profile.conversation  # default from dataset
    
    if data.enable_long_term_memory and session_group_id:
        # Load previous session data from group
        group = await session.get(SessionGroup, session_group_id)
        if group:
            # Get the latest completed session in this group for memory
            prev_stmt = (
                select(CounselingSession)
                .where(
                    CounselingSession.user_id == user_id,
                    CounselingSession.status == "completed",
                )
                .order_by(CounselingSession.ended_at.desc())
                .limit(1)
            )
            prev_result = await session.execute(prev_stmt)
            prev_session = prev_result.scalars().first()
            if prev_session and prev_session.messages:
                # Merge dataset conversations with actual session history
                previous_conversations = profile.conversation + [
                    {"role": "Counselor" if m["role"] == "user" else "Seeker", "content": m["content"]}
                    for m in prev_session.messages
                    if m.get("role") in ("user", "assistant")
                ]
            session_number = group.session_count + 1
    elif data.enable_long_term_memory and not session_group_id:
        # Create new session group
        group = SessionGroup(
            user_id=user_id,
            profile_id=data.profile_id,
            title=f"与{profile.gender}{profile.age}岁{profile.occupation}的咨询",
        )
        session.add(group)
        await session.commit()
        await session.refresh(group)
        session_group_id = group.id
    
    # Check for cached initialization
    cache_stmt = select(SeekerProfileCache).where(
        SeekerProfileCache.profile_id == data.profile_id,
        SeekerProfileCache.has_long_term_memory == data.enable_long_term_memory,
    )
    cache_result = await session.execute(cache_stmt)
    cache = cache_result.scalars().first()
    
    # Create engine
    engine = SimulatorEngine(
        portrait=portrait,
        report=profile.report,
        previous_conversations=previous_conversations,
        has_long_term_memory=data.enable_long_term_memory,
    )
    
    if cache:
        # Reuse cached initialization
        engine.load_from_cache({
            "system_prompt": cache.system_prompt,
            "complaint_chain": cache.complaint_chain,
            "style": cache.style,
            "situation": cache.situation,
            "status": cache.status,
            "event": cache.event,
            "scales": cache.scales,
            "has_long_term_memory": cache.has_long_term_memory,
        })
        cache.used_count += 1
    else:
        # Initialize from scratch and cache
        state = await engine.initialize()
        new_cache = SeekerProfileCache(
            profile_id=data.profile_id,
            system_prompt=state["system_prompt"],
            complaint_chain=state["complaint_chain"],
            style=state["style"],
            situation=state["situation"],
            status=state["status"],
            event=state["event"],
            scales=state["scales"],
            has_long_term_memory=data.enable_long_term_memory,
        )
        session.add(new_cache)
        await session.commit()
        await session.refresh(new_cache)
        cache = new_cache
    
    # Create counseling session record
    cs = CounselingSession(
        user_id=user_id,
        profile_id=data.profile_id,
        cache_id=cache.id,
        has_long_term_memory=data.enable_long_term_memory,
        session_number=session_number,
    )
    if session_group_id:
        # Update group session count
        group_obj = await session.get(SessionGroup, session_group_id)
        if group_obj:
            group_obj.session_count += 1
    
    session.add(cs)
    await session.commit()
    await session.refresh(cs)
    
    # Store engine in memory
    _active_engines[cs.id] = engine
    
    profile_summary = f"{profile.gender}，{profile.age}岁，{profile.occupation}，{profile.marital_status}"
    
    return StartSessionResponse(
        session_id=cs.id,
        session_group_id=session_group_id,
        profile_summary=profile_summary,
        session_number=session_number,
    )


@router.post("/sessions/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """发送咨询师消息，获取来访者回复。"""
    engine = _active_engines.get(data.session_id)
    if not engine:
        raise HTTPException(status_code=404, detail="Session 不存在或已结束，请重新开始")
    
    # Verify session ownership
    cs = await session.get(CounselingSession, data.session_id)
    if not cs or cs.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问此 session")
    
    result = await engine.chat(data.message)
    
    # Persist conversation state
    cs.messages = engine.messages.copy()
    cs.chain_index = engine.chain_index
    cs.runtime_state = engine.get_state()
    await session.commit()
    
    return ChatResponse(
        session_id=data.session_id,
        response=result["response"],
        emotion=result["emotion"],
        current_complaint_stage=result["complaint_stage"],
        turn_count=result["turn_count"],
    )


@router.post("/sessions/end", response_model=EndSessionResponse)
async def end_session(
    data: EndSessionRequest,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """结束咨询 session 并生成评估。"""
    cs = await session.get(CounselingSession, data.session_id)
    if not cs or cs.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session 不存在")
    
    engine = _active_engines.get(data.session_id)
    
    # Calculate duration
    cs.ended_at = datetime.now(timezone.utc)
    cs.duration_seconds = int((cs.ended_at - cs.started_at).total_seconds())
    cs.status = "completed"
    
    # Generate evaluation
    if engine and engine.conversation:
        profile = await session.get(SeekerProfile, cs.profile_id)
        profile_info = f"{profile.gender}，{profile.age}岁，{profile.occupation}，症状：{profile.symptoms}" if profile else ""
        
        evaluation = await evaluate_session(
            conversation=engine.conversation,
            profile_info=profile_info,
            difficulty=profile.difficulty if profile else "intermediate",
        )
        cs.evaluation = evaluation
        cs.score = evaluation.get("overall_score", 0)
    
    await session.commit()
    
    # Cleanup engine
    _active_engines.pop(data.session_id, None)
    
    return EndSessionResponse(
        session_id=cs.id,
        status=cs.status,
        evaluation=cs.evaluation,
        score=cs.score,
        duration_seconds=cs.duration_seconds,
    )


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取 session 详情（含对话记录和评估）。"""
    cs = await session.get(CounselingSession, session_id)
    if not cs or cs.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session 不存在")
    return cs


@router.get("/session-groups", response_model=list[SessionGroupResponse])
async def list_session_groups(
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_current_user_id),
):
    """获取用户的 session 组列表（长期记忆模式）。"""
    stmt = (
        select(SessionGroup)
        .where(SessionGroup.user_id == user_id)
        .order_by(SessionGroup.updated_at.desc())
    )
    result = await session.execute(stmt)
    groups = result.scalars().all()
    return [SessionGroupResponse(**g.__dict__) for g in groups]
