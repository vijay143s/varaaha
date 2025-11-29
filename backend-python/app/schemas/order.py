from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .address import AddressInput
from .payment import SuccessResponse


class OrderItemInput(BaseModel):
    product_id: int = Field(gt=0, alias="productId")
    quantity: int = Field(gt=0, le=999)

    model_config = {"populate_by_name": True}


class CreateOrderRequest(BaseModel):
    items: list[OrderItemInput]
    payment_method: str = Field(default="cash_on_delivery", alias="paymentMethod", max_length=50)
    payment_transaction_id: int | None = Field(default=None, alias="paymentTransactionId")
    coupon_code: str | None = Field(default=None, alias="couponCode", min_length=3, max_length=50)
    shipping_address_id: int | None = Field(default=None, alias="shippingAddressId")
    billing_address_id: int | None = Field(default=None, alias="billingAddressId")
    shipping_address: AddressInput | None = Field(default=None, alias="shippingAddress")
    billing_address: AddressInput | None = Field(default=None, alias="billingAddress")
    notes: str | None = Field(default=None, max_length=500)
    order_type: Literal["one_time", "scheduled"] = Field(default="one_time", alias="orderType")
    schedule_start_date: date | None = Field(default=None, alias="scheduleStartDate")
    schedule_end_date: date | None = Field(default=None, alias="scheduleEndDate")
    schedule_except_days: list[str] = Field(default_factory=list, alias="scheduleExceptDays")
    schedule_pause: bool = Field(default=False, alias="schedulePause")

    model_config = {
        "populate_by_name": True,
    }

    @field_validator("schedule_except_days", mode="after")
    @classmethod
    def deduplicate_days(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for day in value:
            lower = day.lower()
            if lower not in seen:
                seen.add(lower)
                ordered.append(lower)
        return ordered

    @field_validator("items")
    @classmethod
    def ensure_items_nonempty(cls, value: list[OrderItemInput]) -> list[OrderItemInput]:
        if not value:
            raise ValueError("At least one item is required")
        return value

    @field_validator("coupon_code")
    @classmethod
    def trim_coupon(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @model_validator(mode="after")
    def validate_addresses(self) -> "CreateOrderRequest":
        if not (self.shipping_address_id or self.shipping_address):
            raise ValueError("Shipping address is required")
        if self.payment_method != "cash_on_delivery" and not self.payment_transaction_id:
            raise ValueError("Payment transaction is required for online payments")
        if self.payment_method == "cash_on_delivery" and self.payment_transaction_id:
            raise ValueError("Payment transaction should not be sent for cash on delivery orders")
        if self.order_type == "scheduled" and not self.schedule_start_date:
            raise ValueError("Schedule start date is required for scheduled deliveries")
        if (
            self.order_type == "scheduled"
            and self.schedule_start_date
            and self.schedule_end_date
            and self.schedule_end_date < self.schedule_start_date
        ):
            raise ValueError("Schedule end date must be after the start date")
        return self


class OrderCreatedData(BaseModel):
    order_number: str = Field(alias="orderNumber")
    total_amount: Decimal = Field(alias="totalAmount")
    subtotal: Decimal = Field(alias="subtotal")
    discount: Decimal = Field(alias="discount")
    coupon_code: str | None = Field(alias="couponCode", default=None)

    model_config = {
        "populate_by_name": True,
        "json_encoders": {Decimal: lambda value: float(value)},
    }


class OrderCreatedResponse(SuccessResponse):
    data: OrderCreatedData


__all__ = [
    "CreateOrderRequest",
    "OrderCreatedResponse",
    "OrderCreatedData",
    "OrderItemInput",
]
