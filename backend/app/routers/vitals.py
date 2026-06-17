from app.models.extended_records import Vitals
from app.routers.records import build_list_router
from app.schemas.extended_records import VitalsCreate, VitalsUpdate, VitalsResponse

router = build_list_router(
    prefix="/api/vitals",
    tag="vitals",
    model=Vitals,
    create_schema=VitalsCreate,
    update_schema=VitalsUpdate,
    response_schema=VitalsResponse,
)
