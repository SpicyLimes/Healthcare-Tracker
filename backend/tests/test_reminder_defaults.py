# backend/tests/test_reminder_defaults.py
"""The default reminder layout must be well-formed and never shared between calls."""
from app.services.reminder_defaults import default_layout


def test_default_layout_has_expected_shape():
    d = default_layout()
    assert d["title"] == "MY DAILY MEDICATIONS"
    assert d["showSidebar"] is True
    assert d["showAvoid"] is True
    assert len(d["sections"]) == 4
    assert [s["theme"] for s in d["sections"]] == ["morning", "midday", "evening", "asneeded"]
    assert all(s["visible"] is True for s in d["sections"])
    assert d["sections"][0]["meds"][0]["name"] == "Multivitamin"


def test_default_layout_returns_a_fresh_copy_each_call():
    a = default_layout()
    a["sections"][0]["meds"].append({"emoji": "X", "name": "mutated", "desc": "", "badge": ""})
    b = default_layout()
    assert len(b["sections"][0]["meds"]) == 2, "default_layout() leaked a shared mutable dict"
