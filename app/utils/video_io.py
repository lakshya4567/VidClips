"""
app/utils/video_io.py

Thin wrapper around OpenCV + ffprobe for reading video metadata and
iterating frames. Every analyzer that needs raw frames goes through
`iter_frames` so frame sampling/downscaling behavior (config-driven)
is applied consistently everywhere, instead of each analyzer opening
its own VideoCapture with its own logic.
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2
import numpy as np

from app.config.settings import settings
from app.core.exceptions import MediaReadError
from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class VideoMetadata:
    path: str
    width: int
    height: int
    fps: float
    frame_count: int
    duration_sec: float
    codec: str


def probe_video(path: str | Path) -> VideoMetadata:
    """Read container-level metadata using ffprobe (falls back to OpenCV)."""
    path = str(path)
    try:
        cmd = [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,nb_frames,codec_name,duration",
            "-of", "json", path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)["streams"][0]
        num, den = (info["r_frame_rate"].split("/") + ["1"])[:2]
        fps = float(num) / float(den) if float(den) else 0.0
        duration = float(info.get("duration", 0.0) or 0.0)
        frame_count = int(info.get("nb_frames", 0) or (duration * fps))
        return VideoMetadata(
            path=path,
            width=int(info["width"]),
            height=int(info["height"]),
            fps=fps,
            frame_count=frame_count,
            duration_sec=duration,
            codec=info.get("codec_name", "unknown"),
        )
    except Exception as exc:  # ffprobe missing, malformed file, etc.
        logger.warning("ffprobe failed (%s), falling back to OpenCV probing", exc)
        return _probe_with_opencv(path)


def _probe_with_opencv(path: str) -> VideoMetadata:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise MediaReadError(f"Could not open video: {path}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps else 0.0
    cap.release()
    return VideoMetadata(
        path=path, width=width, height=height, fps=fps,
        frame_count=frame_count, duration_sec=duration, codec="unknown",
    )


def _maybe_downscale(frame: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = frame.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return frame
    scale = max_dim / longest
    return cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def iter_frames(
    path: str | Path,
    stride: int | None = None,
    max_dim: int | None = None,
) -> Iterator[tuple[int, float, np.ndarray]]:
    """
    Yield (frame_index, timestamp_sec, frame_bgr) for a video.

    `stride` skips frames (1 = every frame). `max_dim` downscales the
    longest edge to keep heavy models fast; pass None to use config
    defaults.
    """
    stride = stride or settings.frame_sample_stride
    max_dim = max_dim or settings.max_frame_dim

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise MediaReadError(f"Could not open video: {path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % stride == 0:
                ts = idx / fps
                yield idx, ts, _maybe_downscale(frame, max_dim)
            idx += 1
    finally:
        cap.release()
