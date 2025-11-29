from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any, TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin, CreatedAtMixin
from .payment import PaymentStatus

if TYPE_CHECKING:
    from .address import Address
    from .payment import PaymentTransaction
    from .user import User
    from .product import Product


class OrderType(str, enum.Enum):
    ONE_TIME = "one_time"
    SCHEDULED = "scheduled"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    billing_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True
    )
    shipping_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True
    )
    order_type: Mapped[OrderType] = mapped_column(SAEnum(OrderType), nullable=False, default=OrderType.ONE_TIME)
    schedule_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    schedule_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    schedule_except_days: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    schedule_paused: Mapped[bool] = mapped_column(default=False)
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
    payment_status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_transactions.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True
    )
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    shipping_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", back_populates="orders")
    billing_address: Mapped["Address | None"] = relationship(
        "Address", foreign_keys=[billing_address_id]
    )
    shipping_address: Mapped["Address | None"] = relationship(
        "Address", foreign_keys=[shipping_address_id]
    )
    payment_transaction: Mapped["PaymentTransaction | None"] = relationship(
        "PaymentTransaction", back_populates="order", uselist=False
    )
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(CreatedAtMixin, Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(191), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


class InventoryChangeType(str, enum.Enum):
    STOCK_IN = "stock_in"
    STOCK_OUT = "stock_out"
    ADJUSTMENT = "adjustment"


class InventoryMovement(CreatedAtMixin, Base):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    change_type: Mapped[InventoryChangeType] = mapped_column(SAEnum(InventoryChangeType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    product: Mapped["Product"] = relationship("Product")


__all__ = [
    "Order",
    "OrderItem",
    "OrderStatus",
    "OrderType",
    "InventoryMovement",
    "InventoryChangeType",
]
