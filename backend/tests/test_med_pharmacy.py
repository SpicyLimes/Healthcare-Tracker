"""Med<->Pharmacy linkage: model, schema resolution, and end-to-end inheritance."""
import uuid

from app.models.doctor import Doctor
from app.models.extended_records import Pharmacy
from app.models.medication import Medication


def _mk_pharmacy(db_session, name="CVS Main St"):
    p = Pharmacy(name=name)
    db_session.add(p)
    db_session.commit()
    return p


def _mk_doctor(db_session, name="Dr. Linked"):
    d = Doctor(name=name)
    db_session.add(d)
    db_session.commit()
    return d


def test_pharmacy_name_resolves_when_linked(db_session):
    p = _mk_pharmacy(db_session)
    m = Medication(name="Lisinopril", pharmacy_id=p.id)
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    assert m.pharmacy_name == "CVS Main St"


def test_pharmacy_name_none_when_unlinked(db_session):
    m = Medication(name="Aspirin")
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    assert m.pharmacy_id is None
    assert m.pharmacy_name is None


def test_prescribing_doctor_display_prefers_linked_doctor(db_session):
    d = _mk_doctor(db_session)
    m = Medication(name="Lisinopril", prescribing_doctor_id=d.id, prescribing_doctor="stale free text")
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    assert m.prescribing_doctor_display == "Dr. Linked"


def test_prescribing_doctor_display_falls_back_to_free_text(db_session):
    m = Medication(name="Aspirin", prescribing_doctor="Dr. Freetext")
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    assert m.prescribing_doctor_display == "Dr. Freetext"


def test_prescribing_doctor_display_none_when_neither(db_session):
    m = Medication(name="Aspirin")
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)
    assert m.prescribing_doctor_display is None


from app.schemas.records import MedicationResponse


def test_response_resolves_names_from_orm(db_session):
    p = _mk_pharmacy(db_session, name="Walgreens")
    d = _mk_doctor(db_session, name="Dr. Resolve")
    m = Medication(name="Metformin", pharmacy_id=p.id, prescribing_doctor_id=d.id)
    db_session.add(m)
    db_session.commit()
    db_session.refresh(m)

    out = MedicationResponse.model_validate(m).model_dump(mode="json")
    assert out["pharmacy_id"] == str(p.id)
    assert out["pharmacy_name"] == "Walgreens"
    assert out["prescribing_doctor"] == "Dr. Resolve"


def test_response_validates_from_plain_dict():
    # The contributor create path builds a pseudo-response from the submission
    # payload dict — no ORM properties available. AliasChoices must fall back.
    out = MedicationResponse.model_validate(
        {
            "id": str(uuid.uuid4()),
            "name": "Aspirin",
            "kind": "medication",
            "dose": None,
            "frequency": None,
            "route": None,
            "prescribing_doctor": "Dr. Freetext",
            "prescribing_doctor_id": None,
            "pharmacy_id": None,
            "start_date": None,
            "end_date": None,
            "is_active": True,
            "notes": None,
            "created_at": "2026-07-14T00:00:00Z",
            "updated_at": "2026-07-14T00:00:00Z",
        }
    ).model_dump(mode="json")
    assert out["prescribing_doctor"] == "Dr. Freetext"
    assert out["pharmacy_name"] is None


def test_response_guest_column_order_stable():
    # Guest list tables render the first 4 non-_id fields; adding pharmacy_name
    # must not change them.
    keys = [k for k in MedicationResponse.model_fields if k != "id" and not k.endswith("_id")]
    assert keys[:4] == ["name", "kind", "dose", "frequency"]


def test_contributor_submission_carries_pharmacy_id(db_session):
    from sqlalchemy import select
    from app.models.submission import SubmissionAction
    from app.models.user import Role
    from app.services import user_service
    from app.services.submission_service import approve_submission, create_submission

    contrib = user_service.create_user(db_session, "c@example.com", "a-strong-passphrase-123", Role.contributor)
    admin = user_service.create_user(db_session, "a@example.com", "a-strong-passphrase-123", Role.admin)
    p = _mk_pharmacy(db_session, name="SubPharm")

    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="medications",
        action=SubmissionAction.create,
        payload={"name": "SubMed", "pharmacy_id": str(p.id)},
    )
    approve_submission(db_session, sub.id, admin.id)

    row = db_session.scalars(select(Medication).where(Medication.name == "SubMed")).first()
    assert row is not None
    assert row.pharmacy_id == p.id


def test_deleting_pharmacy_unlinks_medication(db_session):
    p = _mk_pharmacy(db_session)
    m = Medication(name="Lisinopril", pharmacy_id=p.id)
    db_session.add(m)
    db_session.commit()
    med_id = m.id

    db_session.delete(p)
    db_session.commit()
    db_session.expire_all()

    survivor = db_session.get(Medication, med_id)
    assert survivor is not None
    assert survivor.pharmacy_id is None
    assert survivor.pharmacy_name is None
