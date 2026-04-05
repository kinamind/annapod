"""annapod - Long-term Memory Vector Store Models."""

import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
from pgvector.sqlalchemy import Vector


class LongTermMemoryChunk(SQLModel, table=True):
    """Vectorized long-term memory chunks for AnnaAgent-style retrieval."""

    __tablename__ = "long_term_memory_chunks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True, max_length=64)
    profile_id: str = Field(index=True, max_length=64)
    session_id: str = Field(index=True, max_length=64)

    turn_index: int = Field(default=0, index=True)
    role: str = Field(max_length=20)  # user / assistant
    content: str = Field(sa_column=Column(Text))

    # gemini-embedding-2-preview returns high-dimensional vectors.
    embedding: list[float] = Field(sa_column=Column(Vector(3072)))

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
