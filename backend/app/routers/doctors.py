import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import DocumentSection
from app.models.doctor import Doctor
from app.routers.records import build_list_router
from app.schemas.records import DoctorCreate, DoctorResponse, DoctorUpdate
from app.schemas.doctor_related import RelatedGroupRead
from app.security.dependencies import get_current_user
from app.services.doctor_related_service import related_records

router = build_list_router(
    prefix="/api/doctors",
    tag="doctors",
    model=Doctor,
    create_schema=DoctorCreate,
    update_schema=DoctorUpdate,
    response_schema=DoctorResponse,
    document_section=DocumentSection.doctors,
)


@router.get(
    "/{doctor_id}/related",
    response_model=list[RelatedGroupRead],
    dependencies=[Depends(get_current_user)],
)
def get_related_records(doctor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Every record pointing at this doctor, grouped by the role they played.

    Read-only reverse lookup over the nine role-typed FKs. Registered after
    build_list_router so it does not shadow the generated /{record_id} route —
    "related" is not a UUID, so the paths cannot collide either way.
    """
    if db.get(Doctor, doctor_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return related_records(db, doctor_id)
