"""Tests for knowledge module — dimensions, search, items."""

import pytest
from httpx import AsyncClient


class TestDimensions:
    async def test_get_dimensions(self, client: AsyncClient):
        resp = await client.get("/api/v1/knowledge/dimensions")
        assert resp.status_code == 200
        data = resp.json()
        assert "schools" in data
        assert "issues" in data
        assert "difficulties" in data


class TestSearch:
    async def test_search_requires_auth(self, client: AsyncClient):
        resp = await client.post("/api/v1/knowledge/search", json={"query": "抑郁"})
        assert resp.status_code == 401

    async def test_search_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post("/api/v1/knowledge/search", json={
            "query": "抑郁",
            "page": 1,
            "page_size": 10,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    async def test_search_with_filters(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post("/api/v1/knowledge/search", json={
            "query": "",
            "school": "CBT",
            "difficulty": "beginner",
            "page": 1,
            "page_size": 5,
        }, headers=auth_headers)
        assert resp.status_code == 200


class TestKnowledgeItem:
    async def test_get_item_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/knowledge/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    async def test_stats_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/knowledge/stats/overview")
        assert resp.status_code == 401

    async def test_stats(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/knowledge/stats/overview", headers=auth_headers)
        assert resp.status_code == 200
