# backend/tests/test_backups_endpoints.py
"""Backups router: authz, list/create/download/upload/delete/restore + audit rows."""
import io
import tarfile

from app.models.audit_log import AuditAction, AuditLog
from app.models.user import Role
from app.services import backup_service as svc
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "backupadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "backupadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "backupviewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "backupviewer@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _mk(root, name, db=b"x", uploads=b"y"):
    d = root / name
    d.mkdir()
    if db is not None:
        (d / svc.DB_FILE).write_bytes(db)
    if uploads is not None:
        (d / svc.UPLOADS_FILE).write_bytes(uploads)
    return d


def _combined_tar_bytes():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for name in (svc.DB_FILE, svc.UPLOADS_FILE):
            ti = tarfile.TarInfo(name=name)
            ti.size = 4
            tar.addfile(ti, io.BytesIO(b"data"))
    buf.seek(0)
    return buf


def _audit_actions(db):
    return [row.action for row in db.query(AuditLog).all()]


def test_list_requires_admin(client, db_session, tmp_backups_dir):
    _viewer(client, db_session)
    assert client.get("/api/backups").status_code == 403


def test_list_returns_backups(client, db_session, tmp_backups_dir):
    _admin(client, db_session)
    _mk(tmp_backups_dir, "2026-07-12")
    r = client.get("/api/backups")
    assert r.status_code == 200
    (item,) = r.json()
    assert item["id"] == "2026-07-12" and item["type"] == "nightly" and item["complete"] is True


def test_backup_now_uses_service_and_audits(client, db_session, tmp_backups_dir, tmp_uploads_dir, monkeypatch):
    csrf = _admin(client, db_session)
    monkeypatch.setattr(svc, "run_pg_dump", lambda url, p: p.write_bytes(b"gz"))
    r = client.post("/api/backups", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 201
    assert r.json()["type"] == "manual"
    assert AuditAction.backup_create in _audit_actions(db_session)


def test_backup_now_requires_csrf(client, db_session, tmp_backups_dir):
    _admin(client, db_session)
    assert client.post("/api/backups").status_code == 403


def test_download_streams_combined_tar_and_audits(client, db_session, tmp_backups_dir):
    _admin(client, db_session)
    _mk(tmp_backups_dir, "2026-07-12", db=b"dbgz", uploads=b"upgz")
    r = client.get("/api/backups/2026-07-12/download")
    assert r.status_code == 200
    assert "healthcare-backup-2026-07-12.tar" in r.headers["content-disposition"]
    with tarfile.open(fileobj=io.BytesIO(r.content)) as tar:
        assert sorted(tar.getnames()) == [svc.DB_FILE, svc.UPLOADS_FILE]
    assert AuditAction.backup_download in _audit_actions(db_session)


def test_download_rejects_bad_id(client, db_session, tmp_backups_dir):
    _admin(client, db_session)
    assert client.get("/api/backups/..%2F..%2Fetc/download").status_code in (400, 404)
    assert client.get("/api/backups/notanid/download").status_code == 400


def test_download_missing_404(client, db_session, tmp_backups_dir):
    _admin(client, db_session)
    assert client.get("/api/backups/2026-01-01/download").status_code == 404


def test_upload_valid_tar(client, db_session, tmp_backups_dir):
    csrf = _admin(client, db_session)
    r = client.post(
        "/api/backups/upload",
        headers={"X-CSRF-Token": csrf},
        files={"file": ("healthcare-backup-x.tar", _combined_tar_bytes(), "application/x-tar")},
    )
    assert r.status_code == 201
    assert r.json()["type"] == "uploaded"
    assert AuditAction.backup_upload in _audit_actions(db_session)


def test_upload_invalid_tar_400(client, db_session, tmp_backups_dir):
    csrf = _admin(client, db_session)
    r = client.post(
        "/api/backups/upload",
        headers={"X-CSRF-Token": csrf},
        files={"file": ("x.tar", io.BytesIO(b"junk"), "application/x-tar")},
    )
    assert r.status_code == 400
    assert list(tmp_backups_dir.iterdir()) == []


def test_delete_backup(client, db_session, tmp_backups_dir):
    csrf = _admin(client, db_session)
    _mk(tmp_backups_dir, "uploaded-2026-07-12T020000")
    r = client.delete("/api/backups/uploaded-2026-07-12T020000", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204
    assert list(tmp_backups_dir.iterdir()) == []
    assert AuditAction.backup_delete in _audit_actions(db_session)


def test_delete_missing_404(client, db_session, tmp_backups_dir):
    csrf = _admin(client, db_session)
    assert client.delete("/api/backups/2026-01-01", headers={"X-CSRF-Token": csrf}).status_code == 404


def test_restore_requires_matching_confirm(client, db_session, tmp_backups_dir, monkeypatch):
    csrf = _admin(client, db_session)
    called = []
    monkeypatch.setattr(svc, "perform_restore", lambda bid: called.append(bid) or "safety-x")
    r = client.post(
        "/api/backups/2026-07-12/restore",
        headers={"X-CSRF-Token": csrf},
        json={"confirm": "wrong"},
    )
    assert r.status_code == 400
    assert called == []


def test_restore_happy_path_audits(client, db_session, tmp_backups_dir, monkeypatch):
    csrf = _admin(client, db_session)
    monkeypatch.setattr(svc, "perform_restore", lambda bid: "safety-2026-07-13T020000")
    r = client.post(
        "/api/backups/2026-07-12/restore",
        headers={"X-CSRF-Token": csrf},
        json={"confirm": "2026-07-12"},
    )
    assert r.status_code == 200
    assert r.json() == {"safety_backup_id": "safety-2026-07-13T020000"}
    assert AuditAction.backup_restore in _audit_actions(db_session)


def test_restore_missing_backup_404(client, db_session, tmp_backups_dir, monkeypatch):
    csrf = _admin(client, db_session)

    def missing(bid):
        raise FileNotFoundError("nope")

    monkeypatch.setattr(svc, "perform_restore", missing)
    r = client.post(
        "/api/backups/2026-07-12/restore",
        headers={"X-CSRF-Token": csrf},
        json={"confirm": "2026-07-12"},
    )
    assert r.status_code == 404


def test_restore_requires_admin(client, db_session, tmp_backups_dir):
    csrf = _viewer(client, db_session)
    r = client.post(
        "/api/backups/2026-07-12/restore",
        headers={"X-CSRF-Token": csrf},
        json={"confirm": "2026-07-12"},
    )
    assert r.status_code == 403
