# backend/tests/test_summary.py
"""One-Page Summary: schema, admin render, guest scoping."""
from app.schemas.summary import SummaryRequest


def test_summary_request_defaults():
    req = SummaryRequest(sections=["doctors"])
    assert req.sections == ["doctors"]
    assert req.include_patient_header is True
    assert req.include_documents is False
    assert req.date_from is None
    assert req.date_to is None
    assert req.prepared_for is None
    assert req.title == "Patient Health Summary"
