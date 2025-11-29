from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ....schemas import payment as payment_schema
from ....services import payments as payment_service
from ...deps import get_current_user, get_db_session

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/razorpay/order", response_model=payment_schema.RazorpayOrderResponse)
async def create_razorpay_order(
    payload: payment_schema.RazorpayOrderRequest,
    session: AsyncSession = Depends(get_db_session),
    user=Depends(get_current_user),
) -> payment_schema.RazorpayOrderResponse:
    data = await payment_service.initiate_razorpay_payment(payload, session=session, user=user)
    return payment_schema.RazorpayOrderResponse(data=data)


@router.post("/razorpay/confirm", response_model=payment_schema.RazorpayConfirmResponse)
async def confirm_razorpay_payment(
    payload: payment_schema.RazorpayConfirmRequest,
    session: AsyncSession = Depends(get_db_session),
    user=Depends(get_current_user),
) -> payment_schema.RazorpayConfirmResponse:
    data = await payment_service.confirm_razorpay_payment(payload, session=session, user=user)
    return payment_schema.RazorpayConfirmResponse(data=data)


@router.post("/razorpay/cancel", response_model=payment_schema.RazorpayCancelResponse)
async def cancel_razorpay_payment(
    payload: payment_schema.RazorpayCancelRequest,
    session: AsyncSession = Depends(get_db_session),
    user=Depends(get_current_user),
) -> payment_schema.RazorpayCancelResponse:
    data = await payment_service.cancel_razorpay_payment(payload, session=session, user=user)
    return payment_schema.RazorpayCancelResponse(data=data)
