import os, time
from fastapi import APIRouter
from app.models.schemas import HealthResponse

router = APIRouter()

_START = time.time()


@router.get("/health", response_model=HealthResponse, summary="Health Check")
async def health():
    """Returns API health status, version, uptime, and whether OpenAI is configured."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    return HealthResponse(
        status="ok",
        version="1.0.0",
        uptime_seconds=round(time.time() - _START, 1),
        openai_configured=bool(api_key and not api_key.startswith("sk-your")),
    )
