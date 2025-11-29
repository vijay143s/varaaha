from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PaymentStatus, PaymentTransaction
from ..schemas.auth import AuthenticatedUser
from ..schemas.payment import (
    RazorpayCancelData,
    RazorpayCancelRequest,
    RazorpayConfirmData,
    RazorpayConfirmRequest,
    RazorpayOrderData,
    RazorpayOrderRequest,
)
from .pricing import CouponError, PricingItemInput, calculate_pricing
from .razorpay import (
    RazorpayConfigurationError,
    assert_configured,
    create_order,
    fetch_payment,
    get_key_id,
    verify_signature,
)


def _amount_to_paise(amount: Decimal) -> int:
    return int((amount * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


async def initiate_razorpay_payment(
    payload: RazorpayOrderRequest,
    *,
    session: AsyncSession,
    user: AuthenticatedUser,
) -> RazorpayOrderData:
    try:
        assert_configured()
    except RazorpayConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    try:
        summary = await calculate_pricing(
            (PricingItemInput(product_id=item.product_id, quantity=item.quantity) for item in payload.items),
            coupon_code=payload.coupon_code,
            session=session,
        )
    except CouponError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    amount = summary.total
    amount_paise = _amount_to_paise(amount)

    if amount_paise <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order amount must be greater than zero")

    transaction = PaymentTransaction(
        user_id=user.id,
        amount=amount,
        amount_paise=amount_paise,
        currency="INR",
        notes={
            "userId": user.id,
            "couponCode": summary.coupon_code or "",
        },
        metadata_payload={
            "items": [item.model_dump() for item in payload.items],
        },
    )

    session.add(transaction)

    try:
        await session.flush()

        receipt = f"txn_{transaction.id}"
        order = await create_order(
            amount_paise=amount_paise,
            currency=transaction.currency,
            receipt=receipt,
            notes={
                "transactionId": str(transaction.id),
                "userId": str(user.id),
                "couponCode": summary.coupon_code or "",
            },
        )

        transaction.status = PaymentStatus.PENDING
        transaction.razorpay_order_id = order.get("id")
        transaction.receipt = order.get("receipt") or receipt

        await session.commit()
    except httpx.HTTPError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to create Razorpay order") from exc
    except Exception:
        await session.rollback()
        raise

    return RazorpayOrderData(
        transaction_id=transaction.id,
        razorpay_order_id=transaction.razorpay_order_id or "",
        currency=transaction.currency,
        amount=transaction.amount,
        amount_paise=transaction.amount_paise,
        key_id=get_key_id(),
        coupon_code=summary.coupon_code,
    )


async def confirm_razorpay_payment(
    payload: RazorpayConfirmRequest,
    *,
    session: AsyncSession,
    user: AuthenticatedUser,
) -> RazorpayConfirmData:
    try:
        assert_configured()
    except RazorpayConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    stmt = (
        select(PaymentTransaction)
        .where(PaymentTransaction.id == payload.transaction_id)
        .with_for_update()
    )
    result = await session.execute(stmt)
    transaction = result.scalar_one_or_none()

    if transaction is None:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment transaction not found")

    if transaction.user_id != user.id:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if transaction.status == PaymentStatus.PAID:
        amount = transaction.amount
        transaction_id = transaction.id
        await session.rollback()
        return RazorpayConfirmData(transaction_id=transaction_id, amount=amount)

    if transaction.razorpay_order_id != payload.razorpay_order_id:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order mismatch for transaction")

    if not verify_signature(
        order_id=payload.razorpay_order_id,
        payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
    ):
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment signature")

    try:
        payment = await fetch_payment(payload.razorpay_payment_id)
    except httpx.HTTPError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to verify payment with Razorpay") from exc

    if payment.get("order_id") != payload.razorpay_order_id:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment does not belong to this order")

    if payment.get("status") not in {"captured", "authorized"}:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment not captured")

    if int(payment.get("amount", 0)) != transaction.amount_paise:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount mismatch")

    transaction.status = PaymentStatus.PAID
    transaction.razorpay_payment_id = payload.razorpay_payment_id
    transaction.razorpay_signature = payload.razorpay_signature

    await session.commit()

    return RazorpayConfirmData(transaction_id=transaction.id, amount=transaction.amount)


async def cancel_razorpay_payment(
    payload: RazorpayCancelRequest,
    *,
    session: AsyncSession,
    user: AuthenticatedUser,
) -> RazorpayCancelData:
    stmt = (
        select(PaymentTransaction)
        .where(PaymentTransaction.id == payload.transaction_id)
        .with_for_update()
    )
    result = await session.execute(stmt)
    transaction = result.scalar_one_or_none()

    if transaction is None:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment transaction not found")

    if transaction.user_id != user.id:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if transaction.status == PaymentStatus.CANCELLED:
        status_value = transaction.status.value
        transaction_id = transaction.id
        await session.rollback()
        return RazorpayCancelData(transaction_id=transaction_id, status=status_value)

    if transaction.status == PaymentStatus.FAILED:
        status_value = transaction.status.value
        transaction_id = transaction.id
        await session.rollback()
        return RazorpayCancelData(transaction_id=transaction_id, status=status_value)

    if transaction.status == PaymentStatus.PAID:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Captured payments cannot be cancelled")

    if transaction.order_id:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment already linked to an order")

    transaction.status = PaymentStatus.CANCELLED
    transaction.error_code = "user_cancelled"
    transaction.error_description = payload.reason or "Payment cancelled by user"

    await session.commit()

    return RazorpayCancelData(transaction_id=transaction.id, status=transaction.status.value)
