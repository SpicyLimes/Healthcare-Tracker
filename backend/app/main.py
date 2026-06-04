from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import SessionLocal
from app.routers import (
    ailments, appointments, auth, dental_history, doctors, family_history,
    health, hospitalizations, insurances, medications, pharmacies, profile,
    surgeries, users, vaccinations, vision_history, visit_logs,
)
from app.services import user_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        created = user_service.seed_admin(db, settings.initial_admin_email, settings.initial_admin_password)
        db.commit()
        if created:
            print(f"[seed] created initial admin: {settings.initial_admin_email}")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise RuntimeError(
            "Failed to seed the initial admin. Check INITIAL_ADMIN_EMAIL and that "
            "INITIAL_ADMIN_PASSWORD meets the password policy (min 12 characters)."
        ) from exc
    finally:
        db.close()
    yield


app = FastAPI(title="Healthcare Tracker API", version="0.4.0", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(medications.router)
app.include_router(doctors.router)
app.include_router(ailments.router)
app.include_router(profile.router)
app.include_router(insurances.router)
app.include_router(pharmacies.router)
app.include_router(family_history.router)
app.include_router(surgeries.router)
app.include_router(hospitalizations.router)
app.include_router(vision_history.router)
app.include_router(dental_history.router)
app.include_router(vaccinations.router)
app.include_router(visit_logs.router)
app.include_router(appointments.router)
