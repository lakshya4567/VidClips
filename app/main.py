"""
app/main.py

FastAPI application entrypoint.

Run directly:
    python -m app.main
or via uvicorn:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config.settings import settings
from app.core.logging_config import get_logger
from app.database.models import init_db

logger = get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    description="Reconstructs editable structure (scenes, camera motion, objects, "
                 "text, depth, color, audio) from an input video.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Serve output files (analysis results, frames, etc.)
outputs_path = Path(settings.outputs_dir)
if outputs_path.exists():
    app.mount("/outputs", StaticFiles(directory=str(outputs_path)), name="outputs")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info(
        "%s starting up (env=%s, device=%s)",
        settings.app_name, settings.environment, settings.resolved_device(),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=True)
