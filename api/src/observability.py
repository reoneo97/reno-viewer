"""Structured request logging.

Emits one JSON line per HTTP request to stdout (captured by `docker compose
logs` / journald). Keeping it as structured JSON means logs stay greppable now
and can be shipped to Loki / Better Stack / etc. later without changing the app.
"""
import json
import logging
import sys
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from jose import JWTError, jwt

from .config import settings

# Dedicated logger with its own stdout handler so output is guaranteed
# regardless of how uvicorn configures the root logger.
logger = logging.getLogger("reno.access")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

# Paths we don't want to log (static asset noise, health pings).
_SKIP_PREFIXES = ("/assets",)
_SKIP_EXACT = {"/health", "/favicon.ico"}


def _username(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(auth[7:], settings.jwt_secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None


def install_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        path = request.url.path
        skip = path in _SKIP_EXACT or path.startswith(_SKIP_PREFIXES)

        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            if not skip:
                logger.info(json.dumps({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "event": "request",
                    "method": request.method,
                    "path": path,
                    "status": status,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                    "user": _username(request),
                    "ip": request.client.host if request.client else None,
                }))
