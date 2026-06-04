from app.models.extended_records import Pharmacy
from app.routers.records import build_list_router
from app.schemas.extended_records import PharmacyCreate, PharmacyUpdate, PharmacyResponse

router = build_list_router(
    prefix="/api/pharmacies",
    tag="pharmacies",
    model=Pharmacy,
    create_schema=PharmacyCreate,
    update_schema=PharmacyUpdate,
    response_schema=PharmacyResponse,
)
