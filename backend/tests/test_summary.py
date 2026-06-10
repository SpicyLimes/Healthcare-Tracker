# backend/tests/test_summary.py
"""One-Page Summary: schema, admin render, guest scoping."""
from app.schemas.summary import SummaryRequest


def test_summary_request_defaults():
    req = SummaryRequest(sections=["doctors"])
    assert req.sections == ["doctors"]
    assert req.include_patient_header is True
    assert req.include_documents is False
    assert req.date_from is None
    assert req.date_to is None
    assert req.prepared_for is None
    assert req.title == "Patient Health Summary"


from app.services import summary_service


def test_section_map_has_all_sections():
    section_map = summary_service.get_section_map()
    # Same 15 sections the guest router exposes
    assert set(section_map.keys()) == {
        "medications", "doctors", "ailments", "profile", "surgeries",
        "hospitalizations", "vision_history", "dental_history", "visit_logs",
        "appointments", "vaccinations", "insurances", "pharmacies",
        "family_history", "nutrition_plan",
    }


def test_gather_section_rows_returns_dicts(client, db_session):
    # Seed one doctor via the admin API so a row exists
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, "sumadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "sumadmin@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Render Test"})

    rows = summary_service.gather_section_rows(db_session, "doctors", date_from=None, date_to=None)
    assert isinstance(rows, list)
    assert any(r.get("name") == "Dr. Render Test" for r in rows)
    # id and *_id columns are stringified but present; renderer filters them later
    assert all(isinstance(r, dict) for r in rows)
