from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.routes.v1 import api_router as v1_router

api_prefix = f"{settings.api_prefix}/v1"

app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    openapi_url=f"{api_prefix}/openapi.json",
    docs_url=f"{api_prefix}/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", summary="Root")
async def root() -> dict[str, str]:
    return {"message": "Welcome to the Varaaha FastAPI backend"}


def register_routes(application: FastAPI) -> None:
    application.include_router(v1_router, prefix=api_prefix)


register_routes(app)
