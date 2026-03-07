"""MindBridge API - Auth Router."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.core.database import get_session
from app.core.security import (
    get_password_hash, verify_password, create_access_token, get_current_user_id,
)
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse, UserUpdate

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, session: AsyncSession = Depends(get_session)):
    """注册新用户。"""
    # Check existing
    existing = await session.execute(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="邮箱或用户名已被注册")
    
    user = User(
        email=data.email,
        username=data.username,
        display_name=data.display_name,
        hashed_password=get_password_hash(data.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(data: UserLogin, session: AsyncSession = Depends(get_session)):
    """用户登录，返回JWT Token。"""
    stmt = select(User).where(
        (User.username == data.username) | (User.email == data.username)
    )
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()
    
    token = create_access_token(data={"sub": user.id})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """获取当前用户信息。"""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """更新当前用户信息。"""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    return user
