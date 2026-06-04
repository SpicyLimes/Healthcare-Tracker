from app.models.document import DocumentSection
from app.models.extended_records import Hospitalization
from app.routers.records import build_list_router
from app.schemas.extended_records import HospitalizationCreate, HospitalizationUpdate, HospitalizationResponse

router = build_list_router(
    prefix="/api/hospitalizations",
    tag="hospitalizations",
    model=Hospitalization,
    create_schema=HospitalizationCreate,
    update_schema=HospitalizationUpdate,
    response_schema=HospitalizationResponse,
    document_section=DocumentSection.hospitalizations,
)
