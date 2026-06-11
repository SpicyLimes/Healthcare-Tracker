"""AI settings singleton: defaults, get-creates-row, update."""
from app.services import ai_settings_service


def test_get_settings_creates_default_disabled_row(db_session):
    s = ai_settings_service.get_settings(db_session)
    assert s.id == 1
    assert s.enabled is False
    assert s.base_url is None
    assert s.model is None


def test_get_settings_is_singleton(db_session):
    a = ai_settings_service.get_settings(db_session)
    b = ai_settings_service.get_settings(db_session)
    assert a.id == b.id == 1
    assert a is b


def test_update_settings_persists_fields(db_session):
    ai_settings_service.get_settings(db_session)
    updated = ai_settings_service.update_settings(
        db_session, enabled=True, base_url="http://localhost:1234/v1", model="test-model"
    )
    assert updated.enabled is True
    assert updated.base_url == "http://localhost:1234/v1"
    assert updated.model == "test-model"
    again = ai_settings_service.get_settings(db_session)
    assert again.enabled is True
    assert again.model == "test-model"
