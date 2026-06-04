from app.models.ailment import Ailment
from app.routers.records import build_list_router
from app.schemas.records import AilmentCreate, AilmentResponse, AilmentUpdate

router = build_list_router(
    prefix="/api/ailments",
    tag="ailments",
    model=Ailment,
    create_schema=AilmentCreate,
    update_schema=AilmentUpdate,
    response_schema=AilmentResponse,
)
