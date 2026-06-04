from app.models.document import DocumentSection
from app.models.extended_records import Appointment
from app.routers.records import build_list_router
from app.schemas.extended_records import AppointmentCreate, AppointmentUpdate, AppointmentResponse

router = build_list_router(
    prefix="/api/appointments",
    tag="appointments",
    model=Appointment,
    create_schema=AppointmentCreate,
    update_schema=AppointmentUpdate,
    response_schema=AppointmentResponse,
    document_section=DocumentSection.appointments,
)
