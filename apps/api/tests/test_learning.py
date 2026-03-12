"""Tests for learning module — dashboard, growth curve, mistakes, recommendations."""

import pytest
from httpx import AsyncClient


class TestDashboard:
    async def test_dashboard_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/learning/dashboard")
        assert resp.status_code == 401

    async def test_dashboard_empty_user(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/learning/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 0
        assert data["average_score"] == 0


class TestGrowthCurve:
    async def test_growth_curve_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/learning/growth-curve")
        assert resp.status_code == 401

    async def test_growth_curve_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/learning/growth-curve", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["data_points"] == []
        assert data["trend"] == "stable"


class TestMistakeBook:
    async def test_mistakes_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/learning/mistakes")
        assert resp.status_code == 401

    async def test_mistakes_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/learning/mistakes", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["mistakes"] == []


class TestRecommendations:
    async def test_recommendations_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/learning/recommendations")
        assert resp.status_code == 401

    async def test_recommendations_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/learning/recommendations", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


class TestEvaluationDimensions:
    async def test_get_dimensions(self, client: AsyncClient):
        resp = await client.get("/api/v1/learning/dimensions")
        assert resp.status_code == 200
        data = resp.json()
        assert "empathy" in data
        assert "active_listening" in data
