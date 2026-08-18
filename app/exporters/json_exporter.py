"""
app/exporters/json_exporter.py

Maps analyzer results onto the specific set of output files the spec
asks for. Each analyzer owns a "domain" (scene_detection -> scenes,
camera_motion -> camera, ...); this module is the only place that
knows the *filenames* — analyzers themselves stay filename-agnostic
so they can be reused/renamed without touching export logic.

Analyzers that failed or were skipped still get an entry in their
JSON file (status + error), so downstream tools can tell "no data"
from "not attempted".
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.core.exceptions import ExportError
from app.core.logging_config import get_logger
from app.pipelines.video_pipeline import PipelineRun

logger = get_logger(__name__)

# analyzer_name -> output filename
_FILE_MAP: dict[str, str] = {
    "scene_detection": "scene_data.json",
    "camera_motion": "camera.json",
    "object_detection": "objects.json",  # also feeds tracking.json (see below)
    "face_pose": "tracking.json",        # merged with object tracks
    "ocr": "subtitles.json",             # OCR/text events double as subtitle-track source
    "depth": "depth.json",
    "segmentation": "effects.json",      # mattes feed compositing/effects
    "color_grading": "color.json",
    "audio": "audio.json",
}


def _write_json(path: Path, payload: Any) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)
    except OSError as exc:
        raise ExportError(f"Failed writing {path}: {exc}") from exc


def export_run(run: PipelineRun, output_dir: Path | None = None) -> dict[str, str]:
    """
    Writes every per-domain JSON file plus project.json / timeline.json /
    keyframes.json / transitions.json, and returns {logical_name: path}.
    """
    from app.config.settings import settings as cfg

    output_dir = output_dir or (cfg.outputs_dir / "metadata" / run.run_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    written: dict[str, str] = {}

    # --- per-analyzer domain files ---
    for analyzer_name, filename in _FILE_MAP.items():
        result = run.results.get(analyzer_name)
        payload = {
            "analyzer": analyzer_name,
            "status": result.status if result else "not_run",
            "duration_sec": round(result.duration_sec, 3) if result else None,
            "error": result.error if result else None,
            "data": result.data if result else {},
        }
        path = output_dir / filename
        _write_json(path, payload)
        written[filename.replace(".json", "")] = str(path)

    # --- timeline.json: unified view keyed by scene boundaries ---
    scene_result = run.results.get("scene_detection")
    scenes = scene_result.data.get("scenes", []) if scene_result and scene_result.status == "ok" else []
    timeline_path = output_dir / "timeline.json"
    _write_json(timeline_path, {"video": run.video_path, "scenes": scenes})
    written["timeline"] = str(timeline_path)

    # --- keyframes.json: derived from camera_motion transitions (tag changes) ---
    camera_result = run.results.get("camera_motion")
    keyframes = []
    if camera_result and camera_result.status == "ok":
        prev_tags = None
        for frame in camera_result.data.get("frames", []):
            tags = tuple(frame.get("motion_tags", []))
            if tags != prev_tags:
                keyframes.append({"frame": frame["frame"], "timestamp_sec": frame["timestamp_sec"], "motion_tags": list(tags)})
                prev_tags = tags
    keyframes_path = output_dir / "keyframes.json"
    _write_json(keyframes_path, {"video": run.video_path, "keyframes": keyframes})
    written["keyframes"] = str(keyframes_path)

    # --- transitions.json: scene boundaries treated as hard-cut transitions ---
    transitions = [
        {"type": "cut", "at_sec": s["start_sec"], "from_scene": s["scene_index"] - 1, "to_scene": s["scene_index"]}
        for s in scenes if s["scene_index"] > 0
    ]
    transitions_path = output_dir / "transitions.json"
    _write_json(transitions_path, {"video": run.video_path, "transitions": transitions})
    written["transitions"] = str(transitions_path)

    # --- project.json: top-level manifest referencing every other file ---
    project = {
        "run_id": run.run_id,
        "video_path": run.video_path,
        "metadata": asdict(run.metadata),
        "analyzers": {
            name: {"status": r.status, "duration_sec": round(r.duration_sec, 3), "error": r.error}
            for name, r in run.results.items()
        },
        "output_files": written,
    }
    project_path = output_dir / "project.json"
    _write_json(project_path, project)
    written["project"] = str(project_path)

    logger.info("Exported %d files to %s", len(written), output_dir)
    return written
