from fastapi import APIRouter

from . import auth, health, orders, payments

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)

__all__ = ["api_router"]
