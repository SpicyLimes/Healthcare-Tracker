from app.models.extended_records import Insurance
from app.routers.records import build_list_router
from app.schemas.extended_records import InsuranceCreate, InsuranceUpdate, InsuranceResponse

router = build_list_router(
    prefix="/api/insurances",
    tag="insurances",
    model=Insurance,
    create_schema=InsuranceCreate,
    update_schema=InsuranceUpdate,
    response_schema=InsuranceResponse,
)
