from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ....schemas import order as order_schema
from ....services import orders as order_service
from ...deps import get_current_user, get_db_session

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=order_schema.OrderCreatedResponse, status_code=201)
async def create_order(
    payload: order_schema.CreateOrderRequest,
    session: AsyncSession = Depends(get_db_session),
    user=Depends(get_current_user),
) -> order_schema.OrderCreatedResponse:
    data = await order_service.create_order(payload, session=session, user=user)
    return order_schema.OrderCreatedResponse(data=data)
