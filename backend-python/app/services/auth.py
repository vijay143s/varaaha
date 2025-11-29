from __future__ import annotations

import hashlib
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.password import verify_password
from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from ..models import User, UserSession
from ..schemas.auth import (
    AuthenticatedUser,
    Credentials,
    RefreshRequest,
    SignoutRequest,
    TokenPayload,
    TokenResponse,
    UserPublic,
)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha512(token.encode("utf-8")).hexdigest()


async def authenticate(
    credentials: Credentials,
    *,
    session: AsyncSession,
    user_agent: str | None,
    ip_address: str | None
) -> TokenResponse:
    stmt = select(User).where(func.lower(User.email) == credentials.email.lower())
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    payload = TokenPayload(sub=str(user.id), email=user.email, roles=[user.role])
    access_token = create_access_token(payload.model_dump())
    refresh_token, expires_at, _ = create_refresh_token({"sub": payload.sub})

    hashed_refresh = _hash_refresh_token(refresh_token)
    await session.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.refresh_token_hash == hashed_refresh)
    )

    user_session = UserSession(
        user_id=user.id,
        refresh_token_hash=hashed_refresh,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=expires_at
    )
    session.add(user_session)
    await session.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserPublic.model_validate(user)
    )


async def refresh_tokens(
    request: RefreshRequest,
    *,
    session: AsyncSession,
    user_agent: str | None,
    ip_address: str | None
) -> TokenResponse:
    payload = decode_refresh_token(request.refresh_token)
    hashed = _hash_refresh_token(request.refresh_token)

    stmt = select(UserSession).where(UserSession.refresh_token_hash == hashed)
    session_result = await session.execute(stmt)
    stored_session = session_result.scalar_one_or_none()

    if stored_session is None or stored_session.expires_at < datetime.utcnow():
        if stored_session is not None:
            await session.delete(stored_session)
            await session.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_stmt = select(User).where(User.id == int(payload.sub))
    user_result = await session.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if user is None:
        await session.delete(stored_session)
        await session.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    await session.delete(stored_session)

    new_payload = TokenPayload(sub=str(user.id), email=user.email, roles=[user.role])
    access_token = create_access_token(new_payload.model_dump())
    new_refresh_token, expires_at, _ = create_refresh_token({"sub": new_payload.sub})
    new_hashed = _hash_refresh_token(new_refresh_token)

    session.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=new_hashed,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at
        )
    )

    await session.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserPublic.model_validate(user)
    )


async def signout(
    user: AuthenticatedUser,
    *,
    session: AsyncSession,
    request: SignoutRequest
) -> None:
    query = delete(UserSession).where(UserSession.user_id == user.id)

    if request.refresh_token:
        hashed = _hash_refresh_token(request.refresh_token)
        query = query.where(UserSession.refresh_token_hash == hashed)

    await session.execute(query)
    await session.commit()
