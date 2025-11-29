from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from ..schemas.auth import TokenPayload
from .config import settings

TOKEN_ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/v1/auth/signin")


def _with_expiry(payload: dict[str, Any], expires_delta: timedelta) -> tuple[dict[str, Any], datetime]:
    expires_at = datetime.utcnow() + expires_delta
    return payload | {"exp": expires_at}, expires_at


def create_access_token(subject: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    payload, _ = _with_expiry(subject.copy(), expires_delta or settings.access_token_expiry)
    return jwt.encode(payload, settings.secret_key, algorithm=TOKEN_ALGORITHM)


def create_refresh_token(
    subject: dict[str, Any],
    *,
    token_id: str | None = None,
    expires_delta: timedelta | None = None
) -> tuple[str, datetime, str]:
    refresh_id = token_id or uuid4().hex
    payload = subject.copy() | {"jti": refresh_id}
    payload_with_expiry, expires_at = _with_expiry(payload, expires_delta or settings.refresh_token_expiry)
    token = jwt.encode(payload_with_expiry, settings.refresh_secret_key, algorithm=TOKEN_ALGORITHM)
    return token, expires_at, refresh_id


def _decode_token(token: str, *, secret: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, secret, algorithms=[TOKEN_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    try:
        return TokenPayload.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token payload") from exc


def decode_access_token(token: str) -> TokenPayload:
    return _decode_token(token, secret=settings.secret_key)


def decode_refresh_token(token: str) -> TokenPayload:
    return _decode_token(token, secret=settings.refresh_secret_key)
