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


def _make_note(db_session, email, title="Old title"):
    admin = _admin(db_session, email)
    note = Note(id=_uuid.uuid4(), author_user_id=admin.id, title=title)
    db_session.add(note)
    db_session.flush()
    return admin, note


def test_stage_edit_note_returns_before_after_and_token_no_write(db_session):
    admin, note = _make_note(db_session, "noteedit1@example.com")
    store = TokenStore()
    result = ai_tools.dispatch(
        db_session, "stage_edit_note",
        {"note_id": str(note.id), "fields": {"title": "New title"}},
        token_store=store, actor_id=admin.id,
    )
    assert result["before"]["title"] == "Old title"
    assert result["after"]["title"] == "New title"
    assert result["token"]
    db_session.expire_all()
    assert db_session.get(Note, note.id).title == "Old title"   # NO write


def test_commit_edit_note_with_token_writes(db_session):
    admin, note = _make_note(db_session, "noteedit2@example.com")
    store = TokenStore()
    staged = ai_tools.dispatch(
        db_session, "stage_edit_note",
        {"note_id": str(note.id), "fields": {"title": "Renamed", "done": True}},
        token_store=store, actor_id=admin.id,
    )
    result = ai_tools.dispatch(db_session, "commit_edit_note",
                               {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert result["updated"] is True
    db_session.expire_all()
    row = db_session.get(Note, note.id)
    assert row.title == "Renamed"
    assert row.done is True


def test_commit_edit_note_can_set_done_false(db_session):
    # Boolean gotcha: explicitly setting done=False must persist (mark to-do not done).
    admin, note = _make_note(db_session, "noteedit_bool@example.com")
    note.done = True
    db_session.flush()
    store = TokenStore()
    staged = ai_tools.dispatch(
        db_session, "stage_edit_note",
        {"note_id": str(note.id), "fields": {"done": False}},
        token_store=store, actor_id=admin.id,
    )
    assert staged["after"]["done"] is False
    ai_tools.dispatch(db_session, "commit_edit_note",
                      {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    db_session.expire_all()
    assert db_session.get(Note, note.id).done is False


def test_stage_edit_note_refuses_viewer(db_session):
    admin, note = _make_note(db_session, "noteedit3@example.com")
    result = ai_tools.dispatch(
        db_session, "stage_edit_note",
        {"note_id": str(note.id), "fields": {"title": "x"}},
        token_store=TokenStore(), actor_id=None,
    )
    assert "error" in result
    assert "token" not in result


def test_stage_edit_note_empty_fields_no_token(db_session):
    admin, note = _make_note(db_session, "noteedit4@example.com")
    result = ai_tools.dispatch(
        db_session, "stage_edit_note",
        {"note_id": str(note.id), "fields": {"bogus": "x"}},
        token_store=TokenStore(), actor_id=admin.id,
    )
    assert "error" in result
    assert "token" not in result


def test_commit_edit_note_wrong_action_token_refused(db_session):
    # a note-DELETE token must not drive a note edit
    admin, note = _make_note(db_session, "noteedit5@example.com")
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_delete_note",
                               {"note_id": str(note.id)}, token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_edit_note",
                               {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in result
    db_session.expire_all()
    assert db_session.get(Note, note.id).title == "Old title"


def test_stage_delete_note_returns_token_no_write(db_session):
    admin, note = _make_note(db_session, "notedel1@example.com", title="Doomed note")
    store = TokenStore()
    before = db_session.query(Note).count()
    result = ai_tools.dispatch(db_session, "stage_delete_note",
                               {"note_id": str(note.id)}, token_store=store, actor_id=admin.id)
    assert result["action"] == "delete_note"
    assert result["token"]
    assert "Doomed note" in str(result["summary"])
    assert db_session.query(Note).count() == before   # NO write


def test_commit_delete_note_with_token_deletes(db_session):
    admin, note = _make_note(db_session, "notedel2@example.com")
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_delete_note",
                               {"note_id": str(note.id)}, token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_delete_note",
                               {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert result["deleted"] is True
    db_session.expire_all()
    assert db_session.get(Note, note.id) is None


def test_stage_delete_note_refuses_viewer_no_write(db_session):
    admin, note = _make_note(db_session, "notedel3@example.com")
    result = ai_tools.dispatch(db_session, "stage_delete_note",
                               {"note_id": str(note.id)}, token_store=TokenStore(), actor_id=None)
    assert "error" in result
    db_session.expire_all()
    assert db_session.get(Note, note.id) is not None


def test_commit_delete_note_fabricated_token_refused_no_write(db_session):
    admin, note = _make_note(db_session, "notedel4@example.com")
    result = ai_tools.dispatch(db_session, "commit_delete_note",
                               {"token": "fabricated"}, token_store=TokenStore(), actor_id=admin.id)
    assert "error" in result
    db_session.expire_all()
    assert db_session.get(Note, note.id) is not None


def test_commit_delete_note_reused_token_refused(db_session):
    admin, note = _make_note(db_session, "notedel5@example.com")
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_delete_note",
                               {"note_id": str(note.id)}, token_store=store, actor_id=admin.id)
    ai_tools.dispatch(db_session, "commit_delete_note", {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    second = ai_tools.dispatch(db_session, "commit_delete_note", {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in second
