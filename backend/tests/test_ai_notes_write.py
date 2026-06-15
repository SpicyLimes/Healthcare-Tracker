"""AI notes-write tools: create/edit/delete a Note via the confirmation-token gate."""
import uuid as _uuid

from app.models.notes import Note
from app.models.user import Role
from app.services import ai_tools, user_service
from app.services.ai_write import TokenStore


def _admin(db_session, email):
    a = user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.admin)
    db_session.flush()
    return a


def test_propose_note_drafts_no_write(db_session):
    before = db_session.query(Note).count()
    result = ai_tools.dispatch(
        db_session, "propose_note",
        {"title": "Call pharmacy", "body": "refill"},
        actor_id=_uuid.uuid4(),
    )
    assert result["action"] == "create_note"
    assert result["fields"]["title"] == "Call pharmacy"
    assert db_session.query(Note).count() == before


def test_propose_note_refuses_viewer(db_session):
    result = ai_tools.dispatch(db_session, "propose_note", {"title": "x"}, actor_id=None)
    assert "error" in result
    assert "read-only" in result["error"].lower()


def test_commit_create_note_writes_and_audits(db_session):
    admin = _admin(db_session, "noteadmin1@example.com")
    before = db_session.query(Note).count()
    result = ai_tools.dispatch(
        db_session, "commit_create_note",
        {"title": "Buy thermometer", "body": "digital"},
        actor_id=admin.id,
    )
    assert result["created"] is True
    assert db_session.query(Note).count() == before + 1
    row = db_session.get(Note, _uuid.UUID(result["note_id"]))
    assert row.title == "Buy thermometer"
    assert row.author_user_id == admin.id

    from app.models.audit_log import AuditLog, AuditAction
    audit = db_session.query(AuditLog).filter_by(
        record_id=result["note_id"], action=AuditAction.create
    ).all()
    assert len(audit) == 1
    assert audit[0].actor_user_id == admin.id


def test_commit_create_note_missing_title_no_write(db_session):
    admin = _admin(db_session, "noteadmin2@example.com")
    before = db_session.query(Note).count()
    result = ai_tools.dispatch(db_session, "commit_create_note", {"body": "no title"}, actor_id=admin.id)
    assert "error" in result
    assert db_session.query(Note).count() == before


def test_commit_create_note_refuses_viewer_no_write(db_session):
    before = db_session.query(Note).count()
    result = ai_tools.dispatch(db_session, "commit_create_note", {"title": "x"}, actor_id=None)
    assert "error" in result
    assert db_session.query(Note).count() == before
