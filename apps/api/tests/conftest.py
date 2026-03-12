"""Shared test fixtures for MindBridge API tests."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import get_password_hash, create_access_token
from app.models.user import User

# Import all models so metadata is complete
import app.models.user  # noqa: F401
import app.models.seeker  # noqa: F401
import app.models.session  # noqa: F401
import app.models.knowledge  # noqa: F401
import app.models.learning  # noqa: F401

settings = get_settings()


@pytest.fixture
async def session():
    """Provide a test session with a per-test engine for full isolation."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=5)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        yield s
    # Clean up all tables after the test
    async with engine.begin() as conn:
        for table in reversed(SQLModel.metadata.sorted_tables):
            await conn.execute(table.delete())
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession):
    """Async HTTP client with patched init_db and overridden session."""
    with patch("app.main.init_db", new_callable=AsyncMock):
        from app.main import app

        async def _override():
            yield session

        app.dependency_overrides[get_session] = _override
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.clear()


@pytest.fixture
async def test_user(session: AsyncSession) -> User:
    """Create a test user in the database."""
    user = User(
        email="test@example.com",
        username="testuser",
        display_name="Test User",
        hashed_password=get_password_hash("password123"),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Return Authorization headers with a valid JWT token."""
    token = create_access_token(data={"sub": test_user.id})
    return {"Authorization": f"Bearer {token}"}
