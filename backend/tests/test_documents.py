"""Document upload, download, delete, cascade delete, and global list tests."""
import io
import os

import pytest

from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "docadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "docadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "docviewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "docviewer@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _make_file(name="test.pdf", mime="application/pdf", size=1024):
    return ("file", (name, io.BytesIO(b"x" * size), mime))


def _create_vaccination(client, csrf):
    r = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "TestVax"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Upload tests
# ---------------------------------------------------------------------------

def test_upload_valid_pdf(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)

    r = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("report.pdf", "application/pdf")],
    )
    assert r.status_code == 201, r.text
    doc = r.json()
    assert doc["filename"] == "report.pdf"
    assert doc["section"] == "vaccinations"
    assert doc["record_id"] == rid
    section_dir = os.path.join(str(tmp_uploads_dir), "vaccinations")
    assert os.path.isdir(section_dir)
    assert len(os.listdir(section_dir)) == 1


def test_upload_invalid_mime_type(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    r = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("bad.exe", "application/x-msdownload")],
    )
    assert r.status_code == 422, r.text


def test_upload_too_large(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    r = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("big.pdf", "application/pdf", size=21 * 1024 * 1024)],
    )
    assert r.status_code == 422, r.text


def test_upload_forbidden_for_viewer(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    viewer_csrf = _viewer(client, db_session)
    r = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": viewer_csrf},
        files=[_make_file()],
    )
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Download tests
# ---------------------------------------------------------------------------

def test_download_as_admin(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    assert upload.status_code == 201
    doc_id = upload.json()["id"]
    r = client.get(f"/api/documents/{doc_id}/download")
    assert r.status_code == 200


def test_download_as_viewer(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    doc_id = upload.json()["id"]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    _viewer(client, db_session)
    r = client.get(f"/api/documents/{doc_id}/download")
    assert r.status_code == 200


def test_download_unauthenticated(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    doc_id = upload.json()["id"]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/documents/{doc_id}/download")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Delete tests
# ---------------------------------------------------------------------------

def test_delete_as_admin(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    doc_id = upload.json()["id"]
    r = client.delete(f"/api/documents/{doc_id}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204
    assert client.get(f"/api/documents/{doc_id}/download").status_code == 404


def test_delete_as_viewer_forbidden(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    doc_id = upload.json()["id"]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    viewer_csrf = _viewer(client, db_session)
    r = client.delete(f"/api/documents/{doc_id}", headers={"X-CSRF-Token": viewer_csrf})
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cascade delete test
# ---------------------------------------------------------------------------

def test_cascade_delete_on_record_delete(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    upload = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file()],
    )
    assert upload.status_code == 201
    doc_id = upload.json()["id"]

    assert client.delete(f"/api/vaccinations/{rid}", headers={"X-CSRF-Token": csrf}).status_code == 204

    assert client.get(f"/api/documents/{doc_id}/download").status_code == 404


# ---------------------------------------------------------------------------
# Global list tests
# ---------------------------------------------------------------------------

def test_global_document_list(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("a.pdf", "application/pdf")],
    )
    r = client.get("/api/documents")
    assert r.status_code == 200
    docs = r.json()
    assert any(d["filename"] == "a.pdf" for d in docs)


def test_global_document_list_section_filter(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("vax_doc.pdf", "application/pdf")],
    )
    r = client.get("/api/documents?section=vaccinations")
    assert r.status_code == 200
    docs = r.json()
    assert all(d["section"] == "vaccinations" for d in docs)

    r2 = client.get("/api/documents?section=surgeries")
    assert r2.status_code == 200
    assert len(r2.json()) == 0


def test_list_documents_for_record(client, db_session, tmp_uploads_dir):
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[_make_file("rec_doc.pdf", "application/pdf")],
    )
    r = client.get(f"/api/vaccinations/{rid}/documents")
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) == 1
    assert docs[0]["filename"] == "rec_doc.pdf"


def test_upload_mime_mismatch_rejected(client, db_session, tmp_uploads_dir):
    """A file whose bytes are JPEG but declared as PDF should be rejected."""
    csrf = _admin(client, db_session)
    rid = _create_vaccination(client, csrf)
    jpeg_bytes = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"\x00" * 100
    r = client.post(
        f"/api/vaccinations/{rid}/documents",
        headers={"X-CSRF-Token": csrf},
        files=[("file", ("photo.pdf", io.BytesIO(jpeg_bytes), "application/pdf"))],
    )
    assert r.status_code == 422, r.text
