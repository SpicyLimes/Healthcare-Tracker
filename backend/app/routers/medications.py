from app.models.document import DocumentSection
from app.models.medication import Medication
from app.routers.records import build_list_router
from app.schemas.records import MedicationCreate, MedicationResponse, MedicationUpdate

router = build_list_router(
    prefix="/api/medications",
    tag="medications",
    model=Medication,
    create_schema=MedicationCreate,
    update_schema=MedicationUpdate,
    response_schema=MedicationResponse,
    document_section=DocumentSection.medications,
)
