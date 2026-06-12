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


def test_validate_update_mode_uses_update_schema():
    cleaned, warnings = ai_write.validate_fields(
        "surgeries", {"procedure": "Updated"}, mode="update"
    )
    assert cleaned["procedure"] == "Updated"
    assert warnings == []


def test_write_section_map_full_tuple_shape():
    from app.models.extended_records import Surgery
    from app.schemas.extended_records import SurgeryCreate, SurgeryUpdate
    model, create_schema, update_schema = ai_write.WRITE_SECTION_MAP["surgeries"]
    assert model is Surgery
    assert create_schema is SurgeryCreate
    assert update_schema is SurgeryUpdate


def test_profile_and_nutrition_excluded():
    assert "profile" not in ai_write.WRITE_SECTION_MAP
    assert "nutrition_plan" not in ai_write.WRITE_SECTION_MAP
