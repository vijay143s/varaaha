from __future__ import annotations

import hmac
from hashlib import sha256
from typing import Any, Mapping

import httpx

from ..core.config import settings

_RAZORPAY_BASE_URL = "https://api.razorpay.com/v1"


class RazorpayConfigurationError(RuntimeError):
    """Raised when Razorpay credentials are missing."""


def _require_credentials() -> tuple[str, str]:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RazorpayConfigurationError(
            "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
        )
    return settings.razorpay_key_id, settings.razorpay_key_secret


def assert_configured() -> None:
    _require_credentials()


def get_key_id() -> str | None:
    return settings.razorpay_key_id


async def create_order(
    *,
    amount_paise: int,
    receipt: str,
    notes: Mapping[str, Any] | None = None,
    currency: str = "INR"
) -> dict[str, Any]:
    key_id, key_secret = _require_credentials()
    payload = {
        "amount": amount_paise,
        "currency": currency,
        "receipt": receipt,
        "payment_capture": 1,
    }
    if notes:
        payload["notes"] = notes

    async with httpx.AsyncClient(base_url=_RAZORPAY_BASE_URL, auth=(key_id, key_secret), timeout=30.0) as client:
        response = await client.post("/orders", json=payload)
        response.raise_for_status()
        return response.json()


async def fetch_payment(payment_id: str) -> dict[str, Any]:
    key_id, key_secret = _require_credentials()
    async with httpx.AsyncClient(base_url=_RAZORPAY_BASE_URL, auth=(key_id, key_secret), timeout=30.0) as client:
        response = await client.get(f"/payments/{payment_id}")
        response.raise_for_status()
        return response.json()


def verify_signature(*, order_id: str, payment_id: str, signature: str) -> bool:
    if not settings.razorpay_key_secret:
        return False
    expected = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


__all__ = [
    "RazorpayConfigurationError",
    "create_order",
    "fetch_payment",
    "verify_signature",
    "assert_configured",
    "get_key_id",
]
