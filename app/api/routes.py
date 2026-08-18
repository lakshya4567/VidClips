"""
app/api/routes.py

REST API surface:
  POST /jobs             - Upload a video and start analysis
  GET  /jobs/{run_id}    - Get a job's status
  GET  /jobs             - List recent jobs
  GET  /analyzers        - List available analyzers
  GET  /health           - Health check
"""

from __future__ import annotations

import shutil
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from pydantic import BaseModel

from app.analyzers.base import get_registered_analyzers
from app.config.settings import settings
from app.database.models import AnalysisJob, get_session
from app.services.job_service import run_job

router = APIRouter()


class JobResponse(BaseModel):
    run_id: str
    status: str


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/analyzers")
def list_analyzers():
    import app.analyzers  # Populate registry

    registry = get_registered_analyzers()

    return [
        {
            "name": name,
            "category": cls.category,
            "requires_gpu": cls.requires_gpu,
            "enabled": getattr(settings, f"enable_{name}", True),
        }
        for name, cls in registry.items()
    ]


@router.post("/jobs", response_model=JobResponse)
async def create_job(background_tasks: BackgroundTasks, file: UploadFile):

    upload_dir = settings.outputs_dir / "videos"
    upload_dir.mkdir(parents=True, exist_ok=True)

    dest = upload_dir / file.filename

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    run_id = str(uuid.uuid4())

    session = get_session()

    job = AnalysisJob(
        run_id=run_id,
        video_path=str(dest),
        status="queued",
    )

    session.add(job)
    session.commit()
    session.close()

    background_tasks.add_task(
        run_job,
        str(dest),
        None,
        run_id,
    )

    return JobResponse(
        run_id=run_id,
        status="queued",
    )


@router.get("/jobs/{run_id}")
def get_job(run_id: str):

    session = get_session()

    job = session.get(AnalysisJob, run_id)

    session.close()

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "run_id": job.run_id,
        "video_path": job.video_path,
        "status": job.status,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "duration_sec": job.duration_sec,
        "output_files": job.output_files,
        "error": job.error,
    }


@router.get("/jobs")
def list_jobs(limit: int = 20):

    session = get_session()

    jobs = (
        session.query(AnalysisJob)
        .order_by(AnalysisJob.created_at.desc())
        .limit(limit)
        .all()
    )

    session.close()

    return [
        {
            "run_id": j.run_id,
            "status": j.status,
            "video_path": j.video_path,
        }
        for j in jobs
    ]