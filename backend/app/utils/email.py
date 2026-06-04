def normalize_email(email: str) -> str:
    """Normalize an email for storage and lookup (strip + lowercase).

    Used by BOTH user creation and authentication — they MUST normalize
    identically, or a user could be created under one form and unable to log in
    under another. Keep this the single source of truth.
    """
    return email.strip().lower()
