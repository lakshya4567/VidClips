"""
app/pipelines/video_pipeline.py
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

from app.analyzers.base import AnalyzerResult, get_registered_analyzers
from app.config.settings import Settings, settings
from app.core.logging_config import get_logger
from app.utils.video_io import VideoMetadata, probe_video

logger = get_logger(__name__)


@dataclass
class PipelineRun:
    run_id: str
    video_path: str
    metadata: VideoMetadata
    results: dict[str, AnalyzerResult] = field(default_factory=dict)


def run_pipeline(
    video_path: str,
    analyzer_names: list[str] | None = None,
    cfg: Settings = settings,
    max_workers: int | None = None,
    run_id: str | None = None,
) -> PipelineRun:
    """
    Run the full (or a filtered subset of the) analyzer suite over a video.
    """
    import app.analyzers  # noqa: F401

    metadata = probe_video(video_path)
    device = cfg.resolved_device()
    registry = get_registered_analyzers()

    to_run = {
        name: cls
        for name, cls in registry.items()
        if analyzer_names is None or name in analyzer_names
    }

    run = PipelineRun(
        run_id=run_id or str(uuid.uuid4()),
        video_path=video_path,
        metadata=metadata,
    )

    max_workers = max_workers or cfg.num_workers

    logger.info(
        "Starting pipeline run %s on '%s' (%d analyzers, device=%s)",
        run.run_id,
        video_path,
        len(to_run),
        device,
    )

    futures = {}

    with ThreadPoolExecutor(max_workers=max_workers) as pool:

        for name, analyzer_cls in to_run.items():
            print(f"Starting analyzer: {name}")
            analyzer = analyzer_cls(settings=cfg, device=device)
            future = pool.submit(analyzer.safe_run, video_path, metadata)
            futures[future] = name

        for future in as_completed(futures):
            name = futures[future]

            try:
                result = future.result()
            except Exception as exc:
                logger.exception("Unexpected failure running analyzer '%s'", name)
                result = AnalyzerResult(
                    analyzer_name=name,
                    status="failed",
                    duration_sec=0.0,
                    error=str(exc),
                )

            run.results[name] = result

            print(f"Collected result: {name}")

            logger.info(
                "Analyzer '%s' finished with status=%s",
                name,
                result.status,
            )

    print("Pipeline returning")

    return run