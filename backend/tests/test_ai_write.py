import pytest
from app.services import ai_write
from app.schemas.extended_records import SurgeryCreate


def test_write_section_map_has_13_sections():
    assert set(ai_write.WRITE_SECTION_MAP.keys()) == {
        "medications", "doctors", "ailments", "surgeries", "hospitalizations",
        "vision_history", "dental_history", "visit_logs", "appointments",
        "vaccinations", "insurances", "pharmacies", "family_history",
    }


def test_write_section_map_tuple_shape():
    model, create_schema, update_schema = ai_write.WRITE_SECTION_MAP["surgeries"]
    assert create_schema is SurgeryCreate


def test_validate_create_drops_bad_field_into_warnings():
    fields = {"procedure": "Appendectomy", "surgery_date": "not-a-date"}
    cleaned, warnings = ai_write.validate_fields("surgeries", fields, mode="create")
    assert cleaned["procedure"] == "Appendectomy"
    assert "surgery_date" not in cleaned
    assert any("surgery_date" in w for w in warnings)


def test_validate_create_never_raises_on_unknown_field():
    cleaned, warnings = ai_write.validate_fields(
        "surgeries", {"procedure": "X", "made_up": 1}, mode="create"
    )
    assert "made_up" not in cleaned
    assert any("made_up" in w for w in warnings)


def test_validate_unknown_section_returns_warning_not_raise():
    cleaned, warnings = ai_write.validate_fields("nope", {"a": 1}, mode="create")
    assert cleaned == {}
    assert warnings and "nope" in warnings[0]
