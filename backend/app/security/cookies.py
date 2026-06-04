from fastapi import Response

from app.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf_token: str) -> None:
    common = {"httponly": True, "secure": settings.cookie_secure, "samesite": "strict", "path": "/"}
    response.set_cookie(ACCESS_COOKIE, access_token, max_age=settings.access_token_ttl_minutes * 60, **common)
    response.set_cookie(REFRESH_COOKIE, refresh_token, max_age=settings.refresh_token_ttl_days * 86400, **common)
    # CSRF cookie is readable by JS (double-submit), so httponly is False
    response.set_cookie(
        CSRF_COOKIE, csrf_token, max_age=settings.refresh_token_ttl_days * 86400,
        httponly=False, secure=settings.cookie_secure, samesite="strict", path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    kwargs = {"secure": settings.cookie_secure, "samesite": "strict", "path": "/"}
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, **kwargs)
