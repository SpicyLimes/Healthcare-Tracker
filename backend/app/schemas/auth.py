import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    role: Role


class UserUpdateRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    full_name: str | None = None


class SetPasswordRequest(BaseModel):
    new_password: str


class UpdateNameRequest(BaseModel):
    full_name: str | None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    is_active: bool
    full_name: str | None = None
    created_at: datetime


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    full_name: str | None = None
