from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import DocumentSection
from app.models.profile import Profile
from app.models.user import User
from app.routers.records import attach_document_routes
from app.schemas.records import ProfileResponse, ProfileWrite
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.services import profile_service
from app.services.errors import NotFoundError

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse, dependencies=[Depends(get_current_user)])
def get_profile(db: Session = Depends(get_db)):
    try:
        return profile_service.get_profile(db)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not set")


@router.put(
    "",
    response_model=ProfileResponse,
    dependencies=[Depends(verify_csrf)],
)
def put_profile(
    payload: ProfileWrite,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    # exclude_unset: a partial PUT must not null the columns it omitted.
    # ProfileWrite defaults 10 of 11 fields to None, and upsert_profile
    # blind-setattrs whatever it receives — so sending only full_name would
    # wipe allergies and emergency_contacts. Matches the 12 generic routers.
    return profile_service.upsert_profile(
        db, payload.model_dump(exclude_unset=True), created_by=current.id
    )


# Profile has a UUID primary key; attach document upload/list routes keyed by that id.
attach_document_routes(router, DocumentSection.profile, Profile)
