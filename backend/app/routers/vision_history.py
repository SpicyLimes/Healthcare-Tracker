from app.models.extended_records import VisionHistory
from app.routers.records import build_list_router
from app.schemas.extended_records import VisionHistoryCreate, VisionHistoryUpdate, VisionHistoryResponse

router = build_list_router(
    prefix="/api/vision-history",
    tag="vision-history",
    model=VisionHistory,
    create_schema=VisionHistoryCreate,
    update_schema=VisionHistoryUpdate,
    response_schema=VisionHistoryResponse,
)
