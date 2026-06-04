from app.models.document import DocumentSection
from app.models.extended_records import Surgery
from app.routers.records import build_list_router
from app.schemas.extended_records import SurgeryCreate, SurgeryUpdate, SurgeryResponse

router = build_list_router(
    prefix="/api/surgeries",
    tag="surgeries",
    model=Surgery,
    create_schema=SurgeryCreate,
    update_schema=SurgeryUpdate,
    response_schema=SurgeryResponse,
    document_section=DocumentSection.surgeries,
)
