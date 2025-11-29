from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Coupon, Product
from ..models.coupon import CouponDiscountType


@dataclass
class PricingItemInput:
    product_id: int
    quantity: int


@dataclass
class PricingItemDetail:
    product_id: int
    product_name: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


@dataclass
class PricingSummary:
    items: list[PricingItemDetail]
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    shipping: Decimal
    total: Decimal
    coupon_code: str | None
    coupon: Coupon | None


class CouponError(Exception):
    """Raised when a coupon cannot be applied."""


_DECIMAL_QUANT = Decimal("0.01")


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(_DECIMAL_QUANT, rounding=ROUND_HALF_UP)


def _validate_products(products: list[Product], expected_ids: set[int]) -> None:
    if len(products) != len(expected_ids):
        raise ValueError("One or more products not found")

    inactive = [product for product in products if not product.is_active]
    if inactive:
        raise ValueError("Some products are inactive")


def _evaluate_coupon(coupon: Coupon, subtotal: Decimal) -> Decimal:
    if not coupon.is_active:
        raise CouponError("Coupon is not active")

    now = datetime.utcnow()
    if coupon.starts_at and now < coupon.starts_at:
        raise CouponError("Coupon is not yet active")
    if coupon.expires_at and now > coupon.expires_at:
        raise CouponError("Coupon has expired")

    if subtotal < (coupon.min_subtotal or Decimal("0")):
        raise CouponError("Order does not meet the minimum subtotal for this coupon")

    if coupon.max_redemptions is not None and coupon.times_redeemed >= coupon.max_redemptions:
        raise CouponError("Coupon redemption limit reached")

    discount_value = Decimal(coupon.discount_value or 0)
    if discount_value <= 0:
        raise CouponError("Coupon discount is invalid")

    if coupon.discount_type == CouponDiscountType.PERCENTAGE:
        discount = _round_currency(subtotal * discount_value / Decimal("100"))
    else:
        discount = _round_currency(discount_value)

    return min(discount, subtotal)


async def calculate_pricing(
    items: Iterable[PricingItemInput],
    *,
    coupon_code: str | None,
    session: AsyncSession
) -> PricingSummary:
    items_list = list(items)
    if not items_list:
        raise ValueError("No items to price")

    product_ids = {item.product_id for item in items_list}
    stmt = select(Product).where(Product.id.in_(list(product_ids)))
    result = await session.execute(stmt)
    products = result.scalars().all()

    _validate_products(products, product_ids)
    product_map = {product.id: product for product in products}

    subtotal = Decimal("0")
    detailed_items: list[PricingItemDetail] = []

    for item in items_list:
        product = product_map[item.product_id]
        unit_price = Decimal(product.price)
        line_total = _round_currency(unit_price * item.quantity)
        subtotal += line_total
        detailed_items.append(
            PricingItemDetail(
                product_id=product.id,
                product_name=product.name,
                unit_price=unit_price,
                quantity=item.quantity,
                line_total=line_total,
            )
        )

    subtotal = _round_currency(subtotal)

    coupon: Coupon | None = None
    discount = Decimal("0")

    if coupon_code:
        coupon_stmt = select(Coupon).where(func.lower(Coupon.code) == coupon_code.lower()).limit(1)
        coupon_result = await session.execute(coupon_stmt)
        coupon = coupon_result.scalar_one_or_none()
        if coupon is None:
            raise CouponError("Coupon not found")
        discount = _evaluate_coupon(coupon, subtotal)

    total = _round_currency(max(subtotal - discount, Decimal("0")))

    tax = Decimal("0")
    shipping = Decimal("0")

    return PricingSummary(
        items=detailed_items,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        shipping=shipping,
        total=total,
        coupon_code=coupon.code if coupon else None,
        coupon=coupon,
    )
