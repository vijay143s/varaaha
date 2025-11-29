from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal
from typing import Any, TYPE_CHECKING

from sqlalchemy import BigInteger, Enum as SAEnum, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from .order import Order
    from .user import User


class PaymentGateway(str, enum.Enum):
    RAZORPAY = "razorpay"


class PaymentStatus(str, enum.Enum):
    CREATED = "created"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentTransaction(TimestampMixin, Base):
    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    gateway: Mapped[PaymentGateway] = mapped_column(SAEnum(PaymentGateway), nullable=False, default=PaymentGateway.RAZORPAY)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), nullable=False, default=PaymentStatus.CREATED)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    razorpay_order_id: Mapped[str | None] = mapped_column(String(191), nullable=True, unique=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    razorpay_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receipt: Mapped[str | None] = mapped_column(String(191), nullable=True)
    notes: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    metadata_payload: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("orders.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="payment_transactions")
    order: Mapped["Order | None"] = relationship("Order", back_populates="payment_transaction", uselist=False)


__all__ = ["PaymentTransaction", "PaymentGateway", "PaymentStatus"]
