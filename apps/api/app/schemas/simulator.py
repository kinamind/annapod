"""annapod - API Schemas: Simulator (Virtual Client)."""

from pydantic import BaseModel
from typing import Optional


class SeekerProfileResponse(BaseModel):
    id: str
    age: str
    gender: str
    occupation: str
    marital_status: str
    symptoms: str
    group_tag: str
    difficulty: str
    issue_tags: Optional[str] = None
    source_id: Optional[str] = None


class SeekerProfileListResponse(BaseModel):
    profiles: list[SeekerProfileResponse]
    total: int
    page: int
    page_size: int


class StartSessionRequest(BaseModel):
    profile_id: str
    enable_long_term_memory: bool = True
    session_group_id: Optional[str] = None  # for multi-session mode


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    response: str
    emotion: Optional[str] = None
    current_complaint_stage: Optional[int] = None
    turn_count: int


class StartSessionResponse(BaseModel):
    session_id: str
    session_group_id: Optional[str] = None
    profile_summary: str
    session_number: int
    init_source: Optional[str] = None  # fresh / cache
    init_duration_ms: Optional[int] = None


class EndSessionRequest(BaseModel):
    session_id: str


class EndSessionResponse(BaseModel):
    session_id: str
    status: str
    evaluation: Optional[dict] = None
    score: Optional[float] = None
    duration_seconds: Optional[int] = None


class SessionGroupResponse(BaseModel):
    id: str
    profile_id: str
    title: str
    description: Optional[str] = None
    session_count: int
    status: str


from datetime import datetime


class SessionListItemResponse(BaseModel):
    id: str
    profile_id: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    score: Optional[float] = None
    turn_count: int
    profile_summary: str
