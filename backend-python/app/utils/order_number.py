from __future__ import annotations

import random
import time


def generate_order_number(prefix: str = "VAR") -> str:
    timestamp = format(int(time.time() * 1000), "x").upper()
    random_part = format(random.randint(0, 36**4 - 1), "x").upper().zfill(4)
    return f"{prefix}-{timestamp}-{random_part}"


__all__ = ["generate_order_number"]
