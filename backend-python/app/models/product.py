from __future__ import annotations

from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base, TimestampMixin


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(191), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(191), nullable=False)
    short_description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="liter")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


__all__ = ["Product"]
