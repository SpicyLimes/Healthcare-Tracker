from app.models.extended_records import VisitLog
from app.routers.records import build_list_router
from app.schemas.extended_records import VisitLogCreate, VisitLogUpdate, VisitLogResponse

router = build_list_router(
    prefix="/api/visit-logs",
    tag="visit-logs",
    model=VisitLog,
    create_schema=VisitLogCreate,
    update_schema=VisitLogUpdate,
    response_schema=VisitLogResponse,
)
