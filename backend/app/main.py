from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Explicit origins only. allow_origins=["*"] is incompatible with
# allow_credentials=True and would be rejected by browsers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single mount point. Every route is served under settings.API_V1_STR;
# no router applies the prefix itself, so it is never duplicated.
app.include_router(api_router, prefix=settings.API_V1_STR)
