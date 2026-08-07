"""Every doctor-bearing record must show the linked doctor's name.

Regression (Cluster A): Medication had a *_display resolver; the other eight
models did not. Choosing a doctor with the picker set only the FK, and since
summary_service hides every *_id, the doctor-facing printout rendered a blank
column — while typing the name as free text kept it. Using the app correctly
lost the name.

Each record type is checked twice: once linked via FK, once free-text.
"""
from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _doctor(client, h, name="Dr Clara Nadar"):
    return client.post("/api/doctors", headers=h, json={"name": name, "specialty": "Surgery"}).json()["id"]


# (section, display_field, fk_field, freetext_field, minimal payload)
CASES = [
    ("surgeries", "surgeon", "surgeon_id", "surgeon_other",
     {"procedure": "Appendectomy", "surgery_date": "2026-05-01"}),
    ("hospitalizations", "attending_physician", "attending_physician_id", "attending_physician_other",
     {"facility": "General Hospital", "admit_date": "2026-05-01"}),
    ("vision-history", "provider", "provider_id", "provider_other",
     {"exam_date": "2026-05-01"}),
    ("dental-history", "provider", "provider_id", "provider_other",
     {"visit_date": "2026-05-01"}),
    ("visit-logs", "doctor", "doctor_id", "doctor_other",
     {"visit_date": "2026-05-01", "reason": "Checkup"}),
    ("appointments", "doctor", "doctor_id", "doctor_other",
     {"appointment_datetime": "2026-05-01T09:00:00Z"}),
    # Ailments reuses the existing `treating_doctor` field name for the resolved
    # value rather than adding a new one, so the API shape is unchanged.
    ("ailments", "treating_doctor", "treating_doctor_id", "treating_doctor",
     {"condition": "Hypertension"}),
]


def test_linked_doctor_name_is_resolved_on_every_record_type(client, db_session):
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    did = _doctor(client, h)

    failures = []
    for section, display, fk, freetext, base in CASES:
        payload = dict(base)
        payload[fk] = did
        res = client.post(f"/api/{section}", headers=h, json=payload)
        assert res.status_code == 201, f"{section}: {res.text}"
        body = res.json()
        if body.get(display) != "Dr Clara Nadar":
            failures.append(f"{section}.{display} = {body.get(display)!r}, expected 'Dr Clara Nadar'")
    assert not failures, "linked doctor name missing:\n  " + "\n  ".join(failures)


def test_freetext_doctor_still_wins_when_no_link(client, db_session):
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}

    failures = []
    for section, display, fk, freetext, base in CASES:
        payload = dict(base)
        payload[freetext] = "Dr. Freetext Fallback"
        res = client.post(f"/api/{section}", headers=h, json=payload)
        assert res.status_code == 201, f"{section}: {res.text}"
        body = res.json()
        if body.get(display) != "Dr. Freetext Fallback":
            failures.append(f"{section}.{display} = {body.get(display)!r}, expected free-text fallback")
    assert not failures, "free-text fallback broken:\n  " + "\n  ".join(failures)


def test_profile_main_doctor_name_is_resolved(client, db_session):
    """Profile has no free-text twin — linked-or-None is the whole contract."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    did = _doctor(client, h, "Dr Primary Care")
    res = client.put("/api/profile", headers=h, json={"full_name": "Jane Doe", "main_doctor_id": did})
    assert res.status_code == 200, res.text
    assert res.json().get("main_doctor") == "Dr Primary Care"


def test_summary_prints_role_label_not_raw_other_column(client, db_session):
    """The printout shows one role-labelled name column, not a raw '… Other' twin.

    Cluster A added resolved fields that fall back to the free-text column, so
    printing both duplicated the name and exposed a 'Surgeon Other' header on
    the sheet handed to a clinician.
    """
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    did = _doctor(client, h)
    client.post("/api/surgeries", headers=h,
                json={"procedure": "picker test", "surgery_date": "2026-05-01", "surgeon_id": did})
    client.post("/api/surgeries", headers=h,
                json={"procedure": "freetext test", "surgery_date": "2026-05-02",
                      "surgeon_other": "Dr. Freetext Fallback"})

    html = client.post("/api/summary", headers=h, json={"sections": ["surgeries"]}).text
    assert "Surgeon Other" not in html
    assert "<th>Surgeon</th>" in html
    # Linked record resolves; free-text record still falls back — once each.
    assert "Dr Clara Nadar" in html
    assert html.count("Dr. Freetext Fallback") == 1
