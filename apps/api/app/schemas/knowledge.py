"""MindBridge - API Schemas: Knowledge Base."""

from pydantic import BaseModel
from typing import Optional


class KnowledgeItemResponse(BaseModel):
    id: str
    school: str
    issue: str
    difficulty: str
    title: str
    content: str
    summary: Optional[str] = None
    source_type: str
    source_ref: Optional[str] = None
    tags: list[str] = []


class KnowledgeSearchRequest(BaseModel):
    query: Optional[str] = None
    school: Optional[str] = None
    issue: Optional[str] = None
    difficulty: Optional[str] = None
    source_type: Optional[str] = None
    page: int = 1
    page_size: int = 20


class KnowledgeSearchResponse(BaseModel):
    items: list[KnowledgeItemResponse]
    total: int
    page: int
    page_size: int


class KnowledgeDimensionResponse(BaseModel):
    """三维知识库维度信息。"""
    schools: list[str]
    issues: list[str]
    difficulties: list[dict]  # [{key, label, description}]
