"""Tests for auth module — register, login, me."""

import pytest
from httpx import AsyncClient
from app.models.user import User


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "display_name": "New User",
            "password": "securepass",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/register", json={
            "email": test_user.email,
            "username": "other",
            "display_name": "Other",
            "password": "pass",
        })
        assert resp.status_code == 400
        assert "已被注册" in resp.json()["detail"]

    async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "other@example.com",
            "username": test_user.username,
            "display_name": "Other",
            "password": "pass",
        })
        assert resp.status_code == 400


class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/login", data={
            "username": test_user.username,
            "password": "password123",
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    async def test_login_with_email(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/login", data={
            "username": test_user.email,
            "password": "password123",
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert resp.status_code == 200

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/login", data={
            "username": test_user.username,
            "password": "wrongpassword",
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", data={
            "username": "nonexistent",
            "password": "whatever",
        }, headers={"Content-Type": "application/x-www-form-urlencoded"})
        assert resp.status_code == 401


class TestMe:
    async def test_get_me(self, client: AsyncClient, test_user: User, auth_headers: dict):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    async def test_get_me_unauthorized(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_update_me(self, client: AsyncClient, test_user: User, auth_headers: dict):
        resp = await client.patch("/api/v1/auth/me", json={
            "display_name": "Updated Name",
            "bio": "A new bio",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Updated Name"
        assert data["bio"] == "A new bio"
