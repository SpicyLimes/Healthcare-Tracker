from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import SessionLocal
from app.routers import auth, health, users
from app.services import user_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed the first admin if the users table is empty.
    db = SessionLocal()
    try:
        created = user_service.seed_admin(db, settings.initial_admin_email, settings.initial_admin_password)
        db.commit()
        if created:
            print(f"[seed] created initial admin: {settings.initial_admin_email}")
    except Exception as exc:  # noqa: BLE001 - surface a clear startup error
        db.rollback()
        raise RuntimeError(
            "Failed to seed the initial admin. Check INITIAL_ADMIN_EMAIL and that "
            "INITIAL_ADMIN_PASSWORD meets the password policy (min 12 characters)."
        ) from exc
    finally:
        db.close()
    yield


app = FastAPI(title="Healthcare Tracker API", version="0.2.0", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
