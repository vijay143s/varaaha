from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.security import decode_access_token, oauth2_scheme
from ..db.session import get_session
from ..models import User
from ..schemas.auth import AuthenticatedUser


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_session():
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session)
) -> AuthenticatedUser:
    payload = decode_access_token(token)

    stmt = select(User).where(User.id == int(payload.sub))
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    return AuthenticatedUser(id=user.id, email=user.email, full_name=user.full_name, roles=[user.role])
