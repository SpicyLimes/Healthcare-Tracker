from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import __version__ as APP_VERSION
from app.database import get_db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Report API liveness and database connectivity."""
    database_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_status = "unavailable"
    return {"status": "ok", "version": APP_VERSION, "database": database_status}
