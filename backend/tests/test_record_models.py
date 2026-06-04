import uuid

from app.models import Ailment, AilmentStatus, Doctor, Medication, MedicationKind, Profile


def test_models_have_shared_columns():
    for model in (Profile, Medication, Doctor, Ailment):
        cols = model.__table__.columns.keys()
        assert "id" in cols
        assert "created_by" in cols
        assert "created_at" in cols
        assert "updated_at" in cols


def test_profile_persists(db_session):
    actor = uuid.uuid4()
    uuid_actor_user(db_session, actor)
    p = Profile(created_by=actor, full_name="Jane Doe")
    db_session.add(p)
    db_session.flush()
    assert p.id is not None


def test_medication_defaults(db_session):
    actor = uuid.uuid4()
    uuid_actor_user(db_session, actor)
    m = Medication(created_by=actor, name="Aspirin")
    db_session.add(m)
    db_session.flush()
    assert m.kind == MedicationKind.medication
    assert m.is_active is True


def test_ailment_default_status(db_session):
    actor = uuid.uuid4()
    uuid_actor_user(db_session, actor)
    a = Ailment(created_by=actor, condition="Hypertension")
    db_session.add(a)
    db_session.flush()
    assert a.status == AilmentStatus.active


def test_doctor_persists(db_session):
    actor = uuid.uuid4()
    uuid_actor_user(db_session, actor)
    d = Doctor(created_by=actor, name="Dr. Smith")
    db_session.add(d)
    db_session.flush()
    assert d.id is not None


def uuid_actor_user(db_session, actor):
    """Helper: a User row so created_by FK is satisfiable within the test txn."""
    from app.models.user import Role, User
    u = User(id=actor, email=f"{actor}@example.com", hashed_password="x", role=Role.admin, is_active=True)
    db_session.add(u)
    db_session.flush()
    return u
