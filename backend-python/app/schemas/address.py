from __future__ import annotations

from pydantic import BaseModel, Field


class AddressInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=191, alias="fullName")
    phone: str | None = Field(default=None, min_length=8, max_length=32)
    address_line1: str = Field(min_length=3, max_length=191, alias="addressLine1")
    address_line2: str | None = Field(default=None, max_length=191, alias="addressLine2")
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=3, max_length=20, alias="postalCode")
    country: str = Field(default="India", min_length=2, max_length=100)
    is_default: bool | None = Field(default=None, alias="isDefault")

    model_config = {
        "populate_by_name": True,
    }


__all__ = ["AddressInput"]
