"""
app/analyzers/color_grading.py

Estimates color-grading characteristics per scene (not per frame, since
grading is applied at the shot level): average RGB balance, saturation,
contrast (std-dev of luma), and a rough shadow/highlight color tint
computed by comparing the mean color of the darkest and brightest
pixel deciles. This gives an approximate, re-appliable "look" profile
rather than a literal LUT.

Honest limitation: recovering an exact 3D LUT or exact grading curve
from rendered pixels is under-determined (many LUTs produce visually
similar output) — this analyzer outputs a descriptive approximation
suitable for guiding a colorist, not a drop-in .cube file. See
docs/LIMITATIONS.md.
"""
from __future__ import annotations

from typing import Any

import cv2
import numpy as np

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.utils.video_io import VideoMetadata, iter_frames


def _analyze_frame_color(frame: np.ndarray) -> dict[str, Any]:
    b, g, r = cv2.split(frame.astype(np.float32))
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
    luma = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)

    flat_luma = luma.flatten()
    dark_thresh = np.percentile(flat_luma, 10)
    bright_thresh = np.percentile(flat_luma, 90)
    shadows_mask = luma <= dark_thresh
    highlights_mask = luma >= bright_thresh

    def _mean_rgb(mask):
        if not np.any(mask):
            return [0.0, 0.0, 0.0]
        return [round(float(np.mean(ch[mask])), 2) for ch in (r, g, b)]

    return {
        "mean_rgb": [round(float(np.mean(r)), 2), round(float(np.mean(g)), 2), round(float(np.mean(b)), 2)],
        "mean_saturation": round(float(np.mean(hsv[..., 1])), 2),
        "contrast_luma_std": round(float(np.std(luma)), 2),
        "shadow_tint_rgb": _mean_rgb(shadows_mask),
        "highlight_tint_rgb": _mean_rgb(highlights_mask),
    }


@register_analyzer
class ColorGradingAnalyzer(BaseAnalyzer):
    name = "color_grading"
    category = "color"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        samples = []
        # Coarse sampling is enough for a per-shot color signature.
        stride = max(int((metadata.fps or 30) * 0.5), 1)
        for idx, ts, frame in iter_frames(video_path, stride=stride):
            stats = _analyze_frame_color(frame)
            stats.update({"frame": idx, "timestamp_sec": round(ts, 3)})
            samples.append(stats)

        return {
            "sample_count": len(samples),
            "samples": samples,
            "note": (
                "Descriptive color profile (balance/contrast/tint), not a "
                "literal LUT extraction. See docs/LIMITATIONS.md."
            ),
        }
