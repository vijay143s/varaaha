from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ....schemas import auth as auth_schema
from ....services import auth as auth_service
from ...deps import get_current_user, get_db_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signin", response_model=auth_schema.TokenResponse, summary="Sign in and obtain tokens")
async def signin(
    credentials: auth_schema.Credentials,
    request: Request,
    session: AsyncSession = Depends(get_db_session)
) -> auth_schema.TokenResponse:
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await auth_service.authenticate(
        credentials,
        session=session,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@router.post("/refresh", response_model=auth_schema.TokenResponse, summary="Refresh access token")
async def refresh_token(
    payload: auth_schema.RefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session)
) -> auth_schema.TokenResponse:
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await auth_service.refresh_tokens(
        payload,
        session=session,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@router.post("/signout", summary="Invalidate the current refresh token")
async def signout(
    body: auth_schema.SignoutRequest | None = None,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
) -> dict[str, str]:
    payload = body or auth_schema.SignoutRequest()
    await auth_service.signout(user, session=session, request=payload)
    return {"detail": "signed out"}
