# backend/tests/test_notes_endpoints.py
import uuid

from app.models.user import Role
from app.services import user_service


def _login_admin(client, db):
    user_service.create_user(db, "admin@notes.example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@notes.example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _login_viewer(client, db, email="viewer@notes.example.com"):
    user_service.create_user(db, email, "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_notes_crud(client, db_session):
    csrf = _login_admin(client, db_session)

    # create
    r = client.post("/api/notes", headers={"X-CSRF-Token": csrf}, json={"title": "Buy meds"})
    assert r.status_code == 201, r.text
    nid = r.json()["id"]
    assert r.json()["pinned"] is False
    assert r.json()["done"] is False

    # list
    r = client.get("/api/notes")
    assert r.status_code == 200
    assert any(n["id"] == nid for n in r.json())

    # patch
    r = client.patch(f"/api/notes/{nid}", headers={"X-CSRF-Token": csrf}, json={"pinned": True})
    assert r.status_code == 200
    assert r.json()["pinned"] is True

    # delete
    r = client.delete(f"/api/notes/{nid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    # confirm gone
    r = client.get("/api/notes")
    assert all(n["id"] != nid for n in r.json())


def test_notes_viewer_can_create(client, db_session):
    csrf = _login_viewer(client, db_session)
    r = client.post("/api/notes", headers={"X-CSRF-Token": csrf}, json={"title": "Viewer note"})
    assert r.status_code == 201, r.text


def test_notes_viewer_can_edit_own(client, db_session):
    csrf = _login_viewer(client, db_session)
    nid = client.post("/api/notes", headers={"X-CSRF-Token": csrf}, json={"title": "Mine"}).json()["id"]
    r = client.patch(f"/api/notes/{nid}", headers={"X-CSRF-Token": csrf}, json={"done": True})
    assert r.status_code == 200
    assert r.json()["done"] is True


def test_notes_viewer_cannot_edit_others(client, db_session):
    # admin creates a note
    admin_csrf = _login_admin(client, db_session)
    nid = client.post("/api/notes", headers={"X-CSRF-Token": admin_csrf}, json={"title": "Admin note"}).json()["id"]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": admin_csrf})

    # viewer tries to patch it
    viewer_csrf = _login_viewer(client, db_session)
    r = client.patch(f"/api/notes/{nid}", headers={"X-CSRF-Token": viewer_csrf}, json={"done": True})
    assert r.status_code == 403


def test_notes_viewer_cannot_delete(client, db_session):
    admin_csrf = _login_admin(client, db_session)
    nid = client.post("/api/notes", headers={"X-CSRF-Token": admin_csrf}, json={"title": "Admin note"}).json()["id"]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": admin_csrf})

    viewer_csrf = _login_viewer(client, db_session)
    r = client.delete(f"/api/notes/{nid}", headers={"X-CSRF-Token": viewer_csrf})
    assert r.status_code == 403


def test_notes_sort_order(client, db_session):
    csrf = _login_admin(client, db_session)
    client.post("/api/notes", headers={"X-CSRF-Token": csrf}, json={"title": "Unpinned"})
    client.post("/api/notes", headers={"X-CSRF-Token": csrf}, json={"title": "Pinned", "pinned": True})
    notes = client.get("/api/notes").json()
    assert notes[0]["pinned"] is True


def test_notes_404(client, db_session):
    csrf = _login_admin(client, db_session)
    missing = str(uuid.uuid4())
    assert client.patch(f"/api/notes/{missing}", headers={"X-CSRF-Token": csrf}, json={"done": True}).status_code == 404
    assert client.delete(f"/api/notes/{missing}", headers={"X-CSRF-Token": csrf}).status_code == 404


def test_notes_unauthenticated(client, db_session):
    assert client.get("/api/notes").status_code == 401


def test_patch_null_title_returns_422(client, db_session):
    csrf = _login_admin(client, db_session)
    nid = client.post("/api/notes", headers={"X-CSRF-Token": csrf},
                      json={"title": "Has Title"}).json()["id"]
    r = client.patch(f"/api/notes/{nid}", headers={"X-CSRF-Token": csrf},
                     json={"title": None})
    assert r.status_code == 422, r.text


def test_viewer_only_sees_own_notes(client, db_session):
    """A viewer should not see notes authored by other users."""
    # Log in as admin, create a note
    admin_csrf = _login_admin(client, db_session)
    client.post("/api/notes", headers={"X-CSRF-Token": admin_csrf}, json={"title": "Admin Note"})
    # Log out admin
    client.post("/api/auth/logout", headers={"X-CSRF-Token": admin_csrf})
    # Log in as viewer, create own note
    viewer_csrf = _login_viewer(client, db_session, email="viewer_scoped@notes.example.com")
    client.post("/api/notes", headers={"X-CSRF-Token": viewer_csrf}, json={"title": "Viewer Note"})
    # Viewer should only see their own note
    notes = client.get("/api/notes").json()
    assert len(notes) == 1
    assert notes[0]["title"] == "Viewer Note"
