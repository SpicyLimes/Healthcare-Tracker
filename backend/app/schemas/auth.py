import uuid
from datetime import datetime
from zoneinfo import available_timezones

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator

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
    full_name: str | None = None


class UserUpdateRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    full_name: str | None = None


class SetPasswordRequest(BaseModel):
    new_password: str


class UpdateNameRequest(BaseModel):
    full_name: str | None


class UpdateTimezoneRequest(BaseModel):
    timezone: str

    @field_validator("timezone")
    @classmethod
    def _must_be_iana_zone(cls, value: str) -> str:
        stripped = value.strip()
        # Empty is allowed: the router falls back to the default zone.
        if stripped and stripped not in available_timezones():
            raise ValueError("Unknown timezone; expected an IANA zone name like 'America/Chicago'")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    is_active: bool
    full_name: str | None = None
    created_at: datetime
    must_change_password: bool = False
    temp_password_expires_at: datetime | None = None


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    full_name: str | None = None
    timezone: str = "America/Chicago"
    must_change_password: bool = False
