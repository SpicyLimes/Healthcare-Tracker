from slowapi import Limiter
from starlette.requests import Request


def _get_real_ip(request: Request) -> str:
    """Resolve the client IP used as the rate-limit key.

    The backend is only ever reached through the bundled nginx reverse proxy
    (it is `expose`d, never published), and nginx sets `X-Real-IP` to the real
    immediate peer (`$remote_addr`) — a value the client cannot forge, because
    nginx overwrites any client-supplied copy.

    We deliberately do NOT trust `CF-Connecting-IP` or `X-Forwarded-For` from
    the request: those are plain client-supplied headers on the LAN/Tailscale
    ingress paths (which bypass Cloudflare entirely), so honoring them would let
    a caller rotate a fake IP per request and defeat the limit. Cloudflare-
    Tunnel traffic all shares the tunnel egress peer, which is acceptable —
    those users are additionally gated upstream by Cloudflare Access (email+OTP).
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_real_ip, headers_enabled=True)
