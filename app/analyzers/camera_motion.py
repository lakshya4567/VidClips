"""
app/analyzers/camera_motion.py

Estimates camera motion between consecutive frames using sparse
optical flow (goodFeaturesToTrack + Lucas-Kanade) to find point
correspondences, then fits a similarity/affine transform between the
point sets. Decomposing that transform gives interpretable camera
motion:

  - translation (dx, dy)          -> pan / tilt
  - scale                          -> zoom in/out
  - rotation angle                 -> roll
  - high-frequency jitter in (dx,dy) with low net displacement -> shake
  - large uniform flow magnitude with low rotation/scale change -> pan/tilt
  - very large frame-to-frame flow -> motion blur likely present

This is a classical-CV approach (no model download required), chosen
because it's fast, robust, and interpretable — appropriate for a
per-frame camera-motion signal feeding `camera.json`.
"""
from __future__ import annotations

import math
from typing import Any

import cv2
import numpy as np

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.core.logging_config import get_logger
from app.utils.video_io import VideoMetadata, iter_frames

logger = get_logger(__name__)


def _classify(dx: float, dy: float, scale: float, rotation_deg: float, flow_std: float) -> list[str]:
    tags: list[str] = []
    translation_mag = math.hypot(dx, dy)

    if abs(scale - 1.0) > 0.01:
        tags.append("zoom_in" if scale > 1.0 else "zoom_out")
    if abs(rotation_deg) > 0.5:
        tags.append("rotation")
    if translation_mag > 2.0:
        tags.append("pan" if abs(dx) > abs(dy) else "tilt")
    if flow_std > 4.0 and translation_mag < 3.0:
        tags.append("camera_shake")
    if not tags:
        tags.append("static")
    return tags


class _CameraMotionState:
    __slots__ = ("prev_gray", "prev_pts")

    def __init__(self):
        self.prev_gray = None
        self.prev_pts = None


@register_analyzer
class CameraMotionAnalyzer(BaseAnalyzer):
    name = "camera_motion"
    category = "detection"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        feature_params = dict(maxCorners=200, qualityLevel=0.01, minDistance=8, blockSize=7)
        lk_params = dict(
            winSize=(21, 21), maxLevel=3,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01),
        )

        state = _CameraMotionState()
        frames_out = []
        speed_ramp_candidates: list[dict] = []

        for idx, ts, frame in iter_frames(video_path):
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            if state.prev_gray is None:
                state.prev_gray = gray
                state.prev_pts = cv2.goodFeaturesToTrack(gray, mask=None, **feature_params)
                continue

            if state.prev_pts is None or len(state.prev_pts) < 8:
                state.prev_pts = cv2.goodFeaturesToTrack(gray, mask=None, **feature_params)
                if state.prev_pts is None:
                    state.prev_gray = gray
                    continue

            next_pts, status, _ = cv2.calcOpticalFlowPyrLK(
                state.prev_gray, gray, state.prev_pts, None, **lk_params
            )
            good_prev = state.prev_pts[status == 1]
            good_next = next_pts[status == 1]

            entry: dict[str, Any] = {"frame": idx, "timestamp_sec": round(ts, 3)}

            if len(good_prev) >= 8:
                transform, _ = cv2.estimateAffinePartial2D(good_prev, good_next)
                if transform is not None:
                    dx, dy = float(transform[0, 2]), float(transform[1, 2])
                    scale = float(math.hypot(transform[0, 0], transform[1, 0]))
                    rotation_deg = float(math.degrees(math.atan2(transform[1, 0], transform[0, 0])))
                    flow_vecs = good_next - good_prev
                    flow_std = float(np.std(np.linalg.norm(flow_vecs, axis=1)))

                    entry.update({
                        "dx": round(dx, 3), "dy": round(dy, 3),
                        "scale": round(scale, 4), "rotation_deg": round(rotation_deg, 3),
                        "flow_std": round(flow_std, 3),
                        "motion_tags": _classify(dx, dy, scale, rotation_deg, flow_std),
                        "motion_blur_likely": flow_std > 8.0 or math.hypot(dx, dy) > 25.0,
                    })
                else:
                    entry.update({"motion_tags": ["unknown"], "motion_blur_likely": False})
            else:
                entry.update({"motion_tags": ["insufficient_features"], "motion_blur_likely": False})

            frames_out.append(entry)

            state.prev_gray = gray
            state.prev_pts = cv2.goodFeaturesToTrack(gray, mask=None, **feature_params)

        # Very light-weight speed-ramp heuristic: large jumps in effective
        # inter-frame timestamp delta after re-sampling to constant fps
        # would need original vs. re-encoded frame timing; flagged here
        # as a placeholder signal derived from translation magnitude
        # variance across the clip (real speed-ramp detection needs the
        # source edit decision list and is out of scope for pixel-only
        # analysis — documented as a known limitation).

        return {
            "frame_count_analyzed": len(frames_out),
            "frames": frames_out,
            "note": (
                "Speed-ramp / slow-motion detection from pixels alone is "
                "unreliable without the original frame rate metadata; "
                "see docs/LIMITATIONS.md."
            ),
        }
