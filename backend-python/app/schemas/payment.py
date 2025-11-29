from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class PaymentItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=999)


class RazorpayOrderRequest(BaseModel):
    items: list[PaymentItem]
    coupon_code: str | None = Field(default=None, min_length=3, max_length=50)

    @field_validator("items")
    @classmethod
    def ensure_items_nonempty(cls, value: list[PaymentItem]) -> list[PaymentItem]:
        if not value:
            raise ValueError("At least one item is required")
        return value

    @field_validator("coupon_code")
    @classmethod
    def normalize_coupon(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class RazorpayConfirmRequest(BaseModel):
    transaction_id: int = Field(gt=0)
    razorpay_order_id: str = Field(min_length=10)
    razorpay_payment_id: str = Field(min_length=10)
    razorpay_signature: str = Field(min_length=10)


class RazorpayCancelRequest(BaseModel):
    transaction_id: int = Field(gt=0)
    reason: str | None = Field(default=None, min_length=3, max_length=200)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class SuccessResponse(BaseModel):
    success: bool = True


class RazorpayOrderData(BaseModel):
    transaction_id: int
    razorpay_order_id: str
    currency: str
    amount: Decimal
    amount_paise: int
    key_id: str | None
    coupon_code: str | None = None


class RazorpayOrderResponse(SuccessResponse):
    data: RazorpayOrderData


class RazorpayConfirmData(BaseModel):
    transaction_id: int
    amount: Decimal


class RazorpayConfirmResponse(SuccessResponse):
    data: RazorpayConfirmData


class RazorpayCancelData(BaseModel):
    transaction_id: int
    status: str


class RazorpayCancelResponse(SuccessResponse):
    data: RazorpayCancelData


__all__ = [
    "PaymentItem",
    "RazorpayOrderRequest",
    "RazorpayConfirmRequest",
    "RazorpayCancelRequest",
    "RazorpayOrderResponse",
    "RazorpayOrderData",
    "RazorpayConfirmResponse",
    "RazorpayConfirmData",
    "RazorpayCancelResponse",
    "RazorpayCancelData",
]
