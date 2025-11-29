from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Address,
    InventoryChangeType,
    InventoryMovement,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    PaymentGateway,
    PaymentStatus,
    PaymentTransaction,
)
from ..schemas.auth import AuthenticatedUser
from ..schemas.order import CreateOrderRequest, OrderCreatedData
from ..utils.order_number import generate_order_number
from .pricing import CouponError, PricingItemInput, calculate_pricing


async def _resolve_address(
    *,
    session: AsyncSession,
    user_id: int,
    address_id: int | None,
    address_payload,
    address_type: str,
) -> int:
    if address_id is not None:
        stmt = select(Address).where(Address.id == address_id, Address.user_id == user_id)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {address_type} address")
        return address_id

    if address_payload is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{address_type.title()} address is required")

    address = Address(
        user_id=user_id,
        full_name=address_payload.full_name,
        phone=address_payload.phone,
        address_line1=address_payload.address_line1,
        address_line2=address_payload.address_line2,
        city=address_payload.city,
        state=address_payload.state,
        postal_code=address_payload.postal_code,
        country=address_payload.country,
        is_default=address_payload.is_default or False,
    )
    session.add(address)
    await session.flush()
    return address.id


async def create_order(
    payload: CreateOrderRequest,
    *,
    session: AsyncSession,
    user: AuthenticatedUser,
) -> OrderCreatedData:
    try:
        pricing = await calculate_pricing(
            (PricingItemInput(product_id=item.product_id, quantity=item.quantity) for item in payload.items),
            coupon_code=payload.coupon_code,
            session=session,
        )
    except CouponError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    payment_status = PaymentStatus.PENDING
    payment_method = payload.payment_method or "cash_on_delivery"
    payment_transaction: PaymentTransaction | None = None

    try:
        if payment_method != "cash_on_delivery":
            if not payload.payment_transaction_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment transaction is required")

            stmt = (
                select(PaymentTransaction)
                .where(PaymentTransaction.id == payload.payment_transaction_id)
                .with_for_update()
            )
            result = await session.execute(stmt)
            payment_transaction = result.scalar_one_or_none()

            if payment_transaction is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment transaction not found")
            if payment_transaction.user_id != user.id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            if payment_transaction.gateway != PaymentGateway.RAZORPAY:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment gateway")
            if payment_transaction.status != PaymentStatus.PAID:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment not captured yet")
            if payment_transaction.order_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment transaction already used")

            difference = abs(float(payment_transaction.amount) - float(pricing.total))
            if difference > 0.5:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount mismatch")

            payment_status = PaymentStatus.PAID
            payment_method = PaymentGateway.RAZORPAY.value

        shipping_address_id = await _resolve_address(
            session=session,
            user_id=user.id,
            address_id=payload.shipping_address_id,
            address_payload=payload.shipping_address,
            address_type="shipping",
        )

        billing_address_id = await _resolve_address(
            session=session,
            user_id=user.id,
            address_id=payload.billing_address_id or payload.shipping_address_id,
            address_payload=payload.billing_address or payload.shipping_address,
            address_type="billing",
        )

        order_number = generate_order_number()

        order = Order(
            order_number=order_number,
            user_id=user.id,
            billing_address_id=billing_address_id,
            shipping_address_id=shipping_address_id,
            order_type=OrderType(payload.order_type),
            schedule_start_date=payload.schedule_start_date,
            schedule_end_date=payload.schedule_end_date,
            schedule_except_days=payload.schedule_except_days or None,
            schedule_paused=payload.schedule_pause,
            status=OrderStatus.PENDING,
            payment_status=payment_status,
            payment_method=payment_method,
            payment_transaction_id=payment_transaction.id if payment_transaction else None,
            coupon_code=pricing.coupon_code,
            subtotal_amount=pricing.subtotal,
            discount_amount=pricing.discount,
            tax_amount=pricing.tax,
            shipping_amount=pricing.shipping,
            total_amount=pricing.total,
        )
        session.add(order)
        await session.flush()

        order_items = [
            OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                product_name=item.product_name,
                unit_price=item.unit_price,
                quantity=item.quantity,
                total_price=item.line_total,
            )
            for item in pricing.items
        ]
        session.add_all(order_items)

        inventory_movements = [
            InventoryMovement(
                product_id=item.product_id,
                change_type=InventoryChangeType.STOCK_OUT,
                quantity=item.quantity,
                note="Order deduction",
            )
            for item in pricing.items
        ]
        session.add_all(inventory_movements)

        if payment_transaction:
            payment_transaction.order_id = order.id

        if pricing.coupon is not None:
            pricing.coupon.times_redeemed = (pricing.coupon.times_redeemed or 0) + 1

        await session.commit()

    except Exception:
        await session.rollback()
        raise

    return OrderCreatedData(
        order_number=order.order_number,
        total_amount=order.total_amount,
        subtotal=order.subtotal_amount,
        discount=order.discount_amount,
        coupon_code=order.coupon_code,
    )
