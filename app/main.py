"""
app/main.py

FastAPI application entrypoint.

The landing page is served from:
    shim.html

Run:
    python -m app.main

or:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config.settings import settings
from app.core.logging_config import get_logger
from app.database.models import init_db

logger = get_logger(__name__)

# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

SHIM_HTML = PROJECT_ROOT / "shim.html"
OUTPUTS_PATH = Path(settings.outputs_dir)


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------

app = FastAPI(
    title=settings.app_name,
    description=(
        "Reconstructs editable structure "
        "(scenes, camera motion, objects, text, depth, color, audio) "
        "from an input video."
    ),
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# API routes
# ---------------------------------------------------------

app.include_router(router)


# ---------------------------------------------------------
# Landing page
# ---------------------------------------------------------

@app.get("/", include_in_schema=False)
async def landing_page():
    """
    Serve shim.html as the main landing page.
    """

    if not SHIM_HTML.exists():
        return {
            "error": "shim.html not found",
            "expected_path": str(SHIM_HTML),
        }

    return FileResponse(
        SHIM_HTML,
        media_type="text/html",
    )


# ---------------------------------------------------------
# Output files
# ---------------------------------------------------------

if OUTPUTS_PATH.exists():
    app.mount(
        "/outputs",
        StaticFiles(directory=str(OUTPUTS_PATH)),
        name="outputs",
    )


# ---------------------------------------------------------
# Startup
# ---------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    init_db()

    logger.info(
        "%s starting up (env=%s, device=%s)",
        settings.app_name,
        settings.environment,
        settings.resolved_device(),
    )


# ---------------------------------------------------------
# Direct execution
# ---------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )