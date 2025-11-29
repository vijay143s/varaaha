from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, TimestampMixin, CreatedAtMixin


if TYPE_CHECKING:
    from .address import Address
    from .order import Order
    from .payment import PaymentTransaction


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(191), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(191), nullable=False)
    full_name: Mapped[str] = mapped_column(String(191), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str] = mapped_column(Enum("customer", "admin", name="user_roles"), default="customer")
    email_verified_at: Mapped[datetime | None] = mapped_column(nullable=True)

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    payment_transactions: Mapped[list["PaymentTransaction"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    addresses: Mapped[list["Address"]] = relationship(
        "Address",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    orders: Mapped[list["Order"]] = relationship(
        "Order",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class UserSession(CreatedAtMixin, Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")
