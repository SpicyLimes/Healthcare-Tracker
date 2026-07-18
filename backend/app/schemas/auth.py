import uuid
from datetime import datetime
from typing import Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator, model_validator

from app.models.user import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str | None = None
    role: Role
    full_name: str | None = None
    send_onboarding_email: bool = False
    expires_minutes: Literal[30, 60, 180, 360, 720, 1440] = 720
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _password_xor_onboarding(self):
        if self.send_onboarding_email and self.password is not None:
            raise ValueError("Do not supply a password when sending an onboarding email")
        if not self.send_onboarding_email and not self.password:
            raise ValueError("A password is required when not sending an onboarding email")
        return self


class UserUpdateRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    full_name: str | None = None


class SetPasswordRequest(BaseModel):
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    expires_minutes: Literal[30, 60, 180, 360, 720, 1440] = 720
    notes: str | None = Field(default=None, max_length=2000)


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


class UserCreateResponse(UserResponse):
    # True/False = onboarding email attempted; None = manual-password create
    email_sent: bool | None = None


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: Role
    full_name: str | None = None
    timezone: str = "America/Chicago"
    must_change_password: bool = False
