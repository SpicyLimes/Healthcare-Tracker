from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()

MIN_PASSWORD_LENGTH = 12


class PasswordPolicyError(ValueError):
    """Raised when a password fails policy validation."""


def hash_password(plain: str) -> str:
    """Hash a plaintext password using the recommended algorithm (Argon2).

    Enforces the password policy first, so a too-weak password is never hashed.
    """
    validate_password_policy(plain)
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if the plaintext matches the hash."""
    return _hasher.verify(plain, hashed)


def validate_password_policy(plain: str) -> None:
    """Raise PasswordPolicyError if the password is too weak."""
    if len(plain) < MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )
