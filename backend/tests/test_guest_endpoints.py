# backend/tests/test_guest_endpoints.py
"""Guest endpoint access: valid token, expired, revoked, section scoping."""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pytest

from app.config import settings
from app.models.share_link import ShareLink
from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "guestadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "guestadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _future(days=7):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _create_link(client, csrf, sections=None, days=7):
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "Test", "expires_at": _future(days), "allowed_sections": sections or []},
    )
    assert r.status_code == 201
    return r.json()["token_url"].split("token=")[1]


def test_guest_can_list_sections(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) == 16  # unscoped = all sections


def test_scoped_token_only_returns_allowed_sections(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["medications", "vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 200
    assert set(r.json()) == {"medications", "vaccinations"}


def test_guest_can_list_allowed_section(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/vaccinations?token={token}")
    assert r.status_code == 200


def test_guest_blocked_from_non_allowed_section(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/medications?token={token}")
    assert r.status_code == 403


def test_expired_token_rejected(client, db_session):
    csrf = _admin(client, db_session)
    link_id = uuid.uuid4()
    past = datetime.now(timezone.utc) - timedelta(days=1)
    expired_token = pyjwt.encode(
        {"sub": str(link_id), "type": "share", "exp": past},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    token_hash = hashlib.sha256(expired_token.encode()).hexdigest()
    link = ShareLink(
        id=link_id,
        label="expired",
        token_hash=token_hash,
        allowed_sections=[],
        expires_at=past,
        revoked=False,
    )
    db_session.add(link)
    db_session.commit()
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={expired_token}")
    assert r.status_code == 401


def test_revoked_token_rejected(client, db_session):
    csrf = _admin(client, db_session)
    data_raw = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "ToRevoke", "expires_at": _future(), "allowed_sections": []},
    )
    link_id = data_raw.json()["id"]
    token = data_raw.json()["token_url"].split("token=")[1]
    client.delete(f"/api/share-links/{link_id}", headers={"X-CSRF-Token": csrf})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 403


def test_guest_token_rejected_by_authenticated_endpoint(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get("/api/medications", cookies={"access_token": token})
    assert r.status_code == 401


def test_guest_can_get_single_record(client, db_session):
    csrf = _admin(client, db_session)
    vax = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "GuestRecordTest"},
    ).json()
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/vaccinations/{vax['id']}?token={token}")
    assert r.status_code == 200
    assert r.json()["vaccine"] == "GuestRecordTest"


def test_guest_single_record_wrong_section_returns_403(client, db_session):
    csrf = _admin(client, db_session)
    vax = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "ScopeTest"},
    ).json()
    token = _create_link(client, csrf, sections=["medications"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/vaccinations/{vax['id']}?token={token}")
    assert r.status_code == 403


def test_guest_can_list_documents_for_record(client, db_session):
    csrf = _admin(client, db_session)
    vax = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "DocListTest"},
    ).json()
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/vaccinations/{vax['id']}/documents?token={token}")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_guest_document_download_returns_404_for_missing_file(client, db_session, tmp_uploads_dir):
    import io
    import os
    import pathlib
    csrf = _admin(client, db_session)
    vax = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "DownloadTest"},
    ).json()
    upload_r = client.post(
        f"/api/vaccinations/{vax['id']}/documents",
        headers={"X-CSRF-Token": csrf},
        files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert upload_r.status_code == 201
    doc_id = upload_r.json()["id"]
    for f in pathlib.Path(tmp_uploads_dir).rglob("*"):
        if f.is_file():
            os.remove(f)
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/documents/{doc_id}/download?token={token}")
    assert r.status_code == 404


def test_guest_patient_name_returns_full_name(client, db_session):
    csrf = _admin(client, db_session)
    # Seed a profile so full_name exists (profile endpoint is PUT /api/profile).
    client.put("/api/profile", headers={"X-CSRF-Token": csrf}, json={"full_name": "Jane Q. Patient"})
    token = _create_link(client, csrf, sections=["doctors"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    res = client.get(f"/api/guest/patient-name?token={token}")
    assert res.status_code == 200, res.text
    assert res.json()["full_name"] == "Jane Q. Patient"


def test_guest_patient_name_rejects_bad_token(client, db_session):
    res = client.get("/api/guest/patient-name?token=bogus")
    assert res.status_code == 401


def test_guest_visit_logs_serializes_bp_fields(client, db_session):
    """Guest visit_logs endpoint must return records with bp_systolic/diastolic/pulse_bpm (even if None)."""
    csrf = _admin(client, db_session)
    vlog = client.post(
        "/api/visit-logs",
        headers={"X-CSRF-Token": csrf},
        json={"visit_date": "2026-01-15", "reason": "Checkup"},
    ).json()
    token = _create_link(client, csrf, sections=["visit_logs"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/visit_logs?token={token}")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    row = next((x for x in rows if x["id"] == vlog["id"]), None)
    assert row is not None
    assert "bp_systolic" in row
    assert "bp_diastolic" in row
    assert "pulse_bpm" in row


def test_guest_nutrition_plan_returns_acceptable_and_unacceptable_foods(client, db_session):
    """Guest nutrition_plan returns acceptable + unacceptable food rows, not meals."""
    csrf = _admin(client, db_session)
    client.post(
        "/api/nutrition/acceptable-foods",
        headers={"X-CSRF-Token": csrf},
        json={"food_name": "Broccoli"},
    )
    client.post(
        "/api/nutrition/unacceptable-foods",
        headers={"X-CSRF-Token": csrf},
        json={"food_name": "Soda"},
    )
    token = _create_link(client, csrf, sections=["nutrition_plan"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/nutrition_plan?token={token}")
    assert r.status_code == 200
    rows = r.json()
    assert any(x["food_name"] == "Broccoli" and x["type"] == "Acceptable" for x in rows)
    assert any(x["food_name"] == "Soda" and x["type"] == "Unacceptable" for x in rows)
    assert all("meal_type" not in x for x in rows)
