from app.models.extended_records import DentalHistory
from app.routers.records import build_list_router
from app.schemas.extended_records import DentalHistoryCreate, DentalHistoryUpdate, DentalHistoryResponse

router = build_list_router(
    prefix="/api/dental-history",
    tag="dental-history",
    model=DentalHistory,
    create_schema=DentalHistoryCreate,
    update_schema=DentalHistoryUpdate,
    response_schema=DentalHistoryResponse,
)
