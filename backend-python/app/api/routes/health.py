from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="API health check")
async def health_check() -> dict[str, str]:
    return {"success": "true", "message": "API is running"}
