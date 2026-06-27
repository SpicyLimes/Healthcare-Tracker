from app.services.email_service import mask_email


def test_mask_email_normal():
    assert mask_email("dr.smith@hospital.com") == "d***@hospital.com"


def test_mask_email_single_char_local():
    assert mask_email("a@example.com") == "a***@example.com"


def test_mask_email_no_at_is_defensive():
    # Input is EmailStr-validated upstream; be defensive anyway.
    assert mask_email("weird") == "w***"
