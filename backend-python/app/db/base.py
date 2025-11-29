from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy declarative base class."""


class CreatedAtMixin:
    created_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )


class TimestampMixin(CreatedAtMixin):
    updated_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )
