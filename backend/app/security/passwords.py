import secrets

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


# Curated 4-6 letter words for human-transcribable temp passwords.
# Two words + 4 digits ≈ 27 bits of entropy — ample for a short-lived,
# single-use credential behind the 10/min login rate limit.
TEMP_PASSWORD_WORDS = (
    "Amber", "Anchor", "Apple", "Aspen", "Autumn", "Badger", "Bamboo", "Basil",
    "Beacon", "Berry", "Birch", "Bison", "Blaze", "Bloom", "Breeze", "Brook",
    "Cactus", "Camel", "Candle", "Canyon", "Carbon", "Castle", "Cedar", "Cherry",
    "Cliff", "Clover", "Cobalt", "Comet", "Copper", "Coral", "Cotton", "Dawn",
    "Delta", "Denim", "Desert", "Drift", "Eagle", "Ember", "Falcon", "Fable",
    "Fern", "Field", "Flint", "Forest", "Fossil", "Garden", "Garnet", "Ginger",
    "Grove", "Harbor", "Hazel", "Heron", "Hollow", "Honey", "Indigo", "Island",
    "Ivory", "Jade", "Jasper", "Kite", "Lagoon", "Larch", "Lemon", "Lilac",
    "Linden", "Lotus", "Magnet", "Mango", "Maple", "Marble", "Meadow", "Mesa",
    "Mint", "Moss", "Nectar", "Nickel", "North", "Nutmeg", "Oasis", "Ocean",
    "Olive", "Onyx", "Opal", "Orbit", "Orchid", "Osprey", "Otter", "Pearl",
    "Pebble", "Pepper", "Pine", "Planet", "Plum", "Pond", "Poplar", "Quartz",
    "Quill", "Raven", "Reef", "Ridge", "River", "Robin", "Rowan", "Ruby",
    "Sage", "Salmon", "Sierra", "Silver", "Spruce", "Stone", "Summit", "Teal",
    "Tempo", "Tiger", "Timber", "Topaz", "Trail", "Tulip", "Tundra", "Valley",
    "Velvet", "Violet", "Walnut", "Willow", "Winter", "Zephyr",
)


def generate_temp_password() -> str:
    """Generate a human-transcribable temp password like 'Maple-Harbor-7482!'.

    Format guarantees the length policy (min word length 4 → total ≥ 15 chars).
    """
    word1 = secrets.choice(TEMP_PASSWORD_WORDS)
    word2 = secrets.choice(TEMP_PASSWORD_WORDS)
    digits = f"{secrets.randbelow(10000):04d}"
    return f"{word1}-{word2}-{digits}!"
