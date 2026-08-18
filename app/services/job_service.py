"""
app/services/job_service.py

Glue layer between the pipeline/exporter and persistence. The API
(background tasks) and the CLI script both call `run_job` so job
tracking behaves identically regardless of entry point.
"""
from __future__ import annotations

import datetime as dt
import time

from app.core.logging_config import get_logger
from app.database.models import AnalysisJob, get_session
from app.exporters.json_exporter import export_run
from app.pipelines.video_pipeline import run_pipeline

logger = get_logger(__name__)


def run_job(
    video_path: str,
    analyzer_names: list[str] | None = None,
    run_id: str | None = None,
) -> str:
    """
    Runs the pipeline synchronously, updates the database,
    exports metadata, and returns the run_id.
    """

    session = get_session()
    start = time.perf_counter()

    run = run_pipeline(
        video_path,
        analyzer_names=analyzer_names,
        run_id=run_id,
    )

    job = session.get(AnalysisJob, run.run_id)

    if job is None:
        job = AnalysisJob(
            run_id=run.run_id,
            video_path=video_path,
            status="running",
        )
        session.add(job)

    job.status = "running"
    session.commit()

    try:
        written = export_run(run)

        job.status = "completed"
        job.output_files = written

    except Exception as exc:  # noqa: BLE001
        logger.exception("Export failed for run %s", run.run_id)
        job.status = "failed"
        job.error = str(exc)

    finally:
        job.completed_at = dt.datetime.utcnow()
        job.duration_sec = time.perf_counter() - start
        session.commit()
        session.close()

    return run.run_id