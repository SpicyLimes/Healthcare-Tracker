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
