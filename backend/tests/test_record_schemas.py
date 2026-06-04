import uuid
from datetime import datetime

from app.schemas.records import (
    AilmentCreate,
    AilmentResponse,
    DoctorCreate,
    MedicationCreate,
    MedicationResponse,
    ProfileWrite,
    ProfileResponse,
)


def test_medication_create_defaults():
    m = MedicationCreate(name="Aspirin")
    assert m.kind == "medication"
    assert m.is_active is True


def test_ailment_create_default_status():
    a = AilmentCreate(condition="Flu")
    assert a.status == "active"


def test_profile_write_requires_full_name():
    import pytest
    with pytest.raises(Exception):
        ProfileWrite()


def test_response_models_from_attributes():
    # responses must accept ORM-like objects
    assert ProfileResponse.model_config.get("from_attributes") is True
    assert MedicationResponse.model_config.get("from_attributes") is True
    assert AilmentResponse.model_config.get("from_attributes") is True


def test_doctor_create_optional_fields():
    d = DoctorCreate(name="Dr. Smith")
    assert d.specialty is None
