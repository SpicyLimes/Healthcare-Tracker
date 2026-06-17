from datetime import datetime, timezone

from app.schemas.extended_records import VitalsResponse


def _resp(**kw):
    base = dict(
        id="11111111-1111-1111-1111-111111111111",
        measured_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
        bp_systolic=None, bp_diastolic=None, pulse_bpm=None,
        height_in=None, weight_lb=None, temperature_f=None,
        respiratory_rate=None, spo2=None, blood_glucose=None,
        notes=None, visit_log_id=None,
        created_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
    )
    base.update(kw)
    return VitalsResponse(**base)


def test_bmi_computed_when_height_and_weight_present():
    r = _resp(height_in=65, weight_lb=150)
    assert r.bmi == 25.0  # round(703*150/65**2, 1)


def test_bmi_null_when_missing_height_or_weight():
    assert _resp(weight_lb=150).bmi is None
    assert _resp(height_in=65).bmi is None
    assert _resp().bmi is None
