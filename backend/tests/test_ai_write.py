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


def test_token_store_round_trip():
    store = ai_write.TokenStore()
    action = {"action": "delete", "section": "surgeries", "record_id": "abc"}
    token = store.stage(action)
    assert isinstance(token, str) and token
    staged = store.consume(token)
    assert staged == {"action": "delete", "section": "surgeries", "record_id": "abc"}


def test_token_is_single_use():
    store = ai_write.TokenStore()
    token = store.stage({"action": "delete"})
    store.consume(token)
    assert store.consume(token) is None        # second use refused


def test_unknown_token_returns_none():
    store = ai_write.TokenStore()
    assert store.consume("not-a-real-token") is None


def test_expired_token_returns_none(monkeypatch):
    store = ai_write.TokenStore(ttl_seconds=10)
    token = store.stage({"action": "delete"})
    monkeypatch.setattr(ai_write.time, "monotonic", lambda: 1_000_000.0)
    assert store.consume(token) is None
    assert store.consume(token) is None        # expired token not retained
