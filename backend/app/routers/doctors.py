from app.models.document import DocumentSection
from app.models.doctor import Doctor
from app.routers.records import build_list_router
from app.schemas.records import DoctorCreate, DoctorResponse, DoctorUpdate

router = build_list_router(
    prefix="/api/doctors",
    tag="doctors",
    model=Doctor,
    create_schema=DoctorCreate,
    update_schema=DoctorUpdate,
    response_schema=DoctorResponse,
    document_section=DocumentSection.doctors,
)
