import uuid
from datetime import timedelta

import pytest

from app.security.tokens import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
    TokenError,
)


def test_access_token_roundtrip():
    uid = str(uuid.uuid4())
    token = create_access_token(user_id=uid, role="admin")
    claims = decode_access_token(token)
    assert claims["sub"] == uid
    assert claims["role"] == "admin"


def test_decode_rejects_tampered_token():
    token = create_access_token(user_id="x", role="viewer")
    with pytest.raises(TokenError):
        decode_access_token(token + "tamper")


def test_decode_rejects_expired_token():
    token = create_access_token(user_id="x", role="viewer", expires_delta=timedelta(seconds=-1))
    with pytest.raises(TokenError):
        decode_access_token(token)


def test_refresh_token_is_random_and_hashable():
    raw1 = generate_refresh_token()
    raw2 = generate_refresh_token()
    assert raw1 != raw2
    assert len(raw1) >= 32
    # Hash is deterministic for the same input, differs for different input
    assert hash_refresh_token(raw1) == hash_refresh_token(raw1)
    assert hash_refresh_token(raw1) != hash_refresh_token(raw2)
