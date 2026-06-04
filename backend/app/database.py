from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models (used in later phases)."""


def get_db():
    """FastAPI dependency that yields a database session.

    Commits on successful request handling and rolls back if the handler
    raises, then always closes the session. Services flush their writes within
    the request; the commit here is what actually persists them.
    """
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
