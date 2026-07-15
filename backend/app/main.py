from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import __version__
from app.config import settings
from app.database import SessionLocal
from app.routers import (
    ai, ailments, appointments, audit_log, auth, backups, calendar, dental_history,
    documents, doctors, family_history, guest, health, hospitalizations, insurances,
    medications, notes, nutrition, pharmacies, profile, reminders, share_links, submissions,
    summary, surgeries, users, vaccinations, vision_history, visit_logs, vitals,
)
from app.routers import settings as settings_router
from app.limiter import limiter
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


app = FastAPI(title="Healthcare Tracker API", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://healthcare.spicylimeslabs.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(ai.router)
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
app.include_router(vitals.router)
app.include_router(appointments.router)
app.include_router(documents.router)
app.include_router(share_links.router)
app.include_router(summary.router)
app.include_router(audit_log.router)
app.include_router(backups.router)
app.include_router(calendar.router)
app.include_router(guest.router)
app.include_router(notes.router)
app.include_router(nutrition.router)
app.include_router(reminders.router)
app.include_router(settings_router.router)
app.include_router(submissions.router)
