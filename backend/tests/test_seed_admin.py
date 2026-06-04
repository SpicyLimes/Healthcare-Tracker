from app.models.user import Role, User
from app.services import user_service


def test_seed_admin_creates_single_admin(db_session):
    assert user_service.seed_admin(db_session, "admin@example.com", "a-strong-passphrase-123") is True
    admins = db_session.query(User).filter_by(role=Role.admin).all()
    assert len(admins) == 1
    assert admins[0].email == "admin@example.com"


def test_seed_admin_is_idempotent(db_session):
    user_service.seed_admin(db_session, "admin@example.com", "a-strong-passphrase-123")
    assert user_service.seed_admin(db_session, "admin@example.com", "a-strong-passphrase-123") is False
    assert db_session.query(User).count() == 1
