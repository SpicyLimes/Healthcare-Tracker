import uuid
from datetime import timedelta

import jwt
import pytest

from app.config import settings
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
    assert len(raw1) >= 64  # token_urlsafe(48) -> 64 chars (~384 bits)
    # Hash is deterministic for the same input, differs for different input
    assert hash_refresh_token(raw1) == hash_refresh_token(raw1)
    assert hash_refresh_token(raw1) != hash_refresh_token(raw2)


def test_decode_rejects_alg_none_token():
    """A forged token with alg:none must be rejected (algorithm-confusion guard)."""
    try:
        forged = jwt.encode({"sub": "x", "role": "admin"}, key="", algorithm="none")
    except Exception:
        import base64, json
        def _b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
        forged = _b64({"alg": "none", "typ": "JWT"}) + "." + _b64({"sub": "x", "role": "admin"}) + "."
    with pytest.raises(TokenError):
        decode_access_token(forged)


def test_decode_rejects_token_signed_with_wrong_secret():
    """A token signed with a different secret must be rejected."""
    import jwt as _jwt
    bad = _jwt.encode({"sub": "x", "role": "admin"}, "a-different-secret", algorithm=settings.jwt_algorithm)
    with pytest.raises(TokenError):
        decode_access_token(bad)
