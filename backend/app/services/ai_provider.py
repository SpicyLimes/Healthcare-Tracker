class ProviderUnavailable(Exception):
    """Raised when the configured LLM provider cannot be reached."""


def ping(base_url: str, model: str) -> tuple[bool, str]:
    return (False, "not implemented")  # replaced in a later task
