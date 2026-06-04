from app.models.extended_records import FamilyHistory
from app.routers.records import build_list_router
from app.schemas.extended_records import FamilyHistoryCreate, FamilyHistoryUpdate, FamilyHistoryResponse

router = build_list_router(
    prefix="/api/family-history",
    tag="family-history",
    model=FamilyHistory,
    create_schema=FamilyHistoryCreate,
    update_schema=FamilyHistoryUpdate,
    response_schema=FamilyHistoryResponse,
)
