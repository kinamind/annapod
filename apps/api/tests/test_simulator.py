"""Tests for simulator module — profiles, sessions."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from app.models.user import User


class TestProfiles:
    async def test_list_profiles_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/simulator/profiles")
        assert resp.status_code == 401

    async def test_list_profiles_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/simulator/profiles", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["profiles"] == []

    async def test_list_groups(self, client: AsyncClient):
        resp = await client.get("/api/v1/simulator/profiles/groups")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestSessions:
    async def test_start_session_not_found_profile(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post("/api/v1/simulator/sessions/start", json={
            "profile_id": "nonexistent-id",
            "enable_long_term_memory": False,
        }, headers=auth_headers)
        assert resp.status_code == 404

    async def test_chat_no_active_session(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post("/api/v1/simulator/sessions/chat", json={
            "session_id": "nonexistent-session",
            "message": "你好",
        }, headers=auth_headers)
        assert resp.status_code == 404

    async def test_end_nonexistent_session(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post("/api/v1/simulator/sessions/end", json={
            "session_id": "nonexistent-session",
        }, headers=auth_headers)
        assert resp.status_code == 404

    async def test_get_session_detail_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/simulator/sessions/nonexistent", headers=auth_headers)
        assert resp.status_code == 404
