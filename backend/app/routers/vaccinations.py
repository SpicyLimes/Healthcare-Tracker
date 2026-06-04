from app.models.document import DocumentSection
from app.models.extended_records import Vaccination
from app.routers.records import build_list_router
from app.schemas.extended_records import VaccinationCreate, VaccinationUpdate, VaccinationResponse

router = build_list_router(
    prefix="/api/vaccinations",
    tag="vaccinations",
    model=Vaccination,
    create_schema=VaccinationCreate,
    update_schema=VaccinationUpdate,
    response_schema=VaccinationResponse,
    document_section=DocumentSection.vaccinations,
)
