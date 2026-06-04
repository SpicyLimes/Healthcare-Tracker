import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.services.errors import NotFoundError


def get_profile(db: Session) -> Profile:
    profile = db.scalar(select(Profile).limit(1))
    if profile is None:
        raise NotFoundError("profile")
    return profile


def upsert_profile(db: Session, data: dict, created_by: uuid.UUID) -> Profile:
    profile = db.scalar(select(Profile).limit(1))
    if profile is None:
        profile = Profile(**data, created_by=created_by)
        db.add(profile)
    else:
        for key, value in data.items():
            setattr(profile, key, value)
    db.flush()
    return profile
