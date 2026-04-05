"""annapod - API Schemas: Authentication."""

from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    email: str
    username: str
    display_name: str
    password: str


class UserLogin(BaseModel):
    username: str  # accepts email or username
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    experience_level: str
    specialization: Optional[str] = None
    is_active: bool


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    experience_level: Optional[str] = None
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
