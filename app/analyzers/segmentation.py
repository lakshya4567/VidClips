"""
app/analyzers/segmentation.py

Human/foreground segmentation via MediaPipe Selfie Segmentation. This
produces per-frame alpha mattes (0-255 PNG) good enough for background
removal / compositing without a physical green screen. Mattes are
written to outputs/masks/segmentation/; segmentation.json stores paths
plus foreground-coverage stats. Instance/semantic segmentation of
arbitrary objects (not just people) is a heavier task (e.g. SAM) and
is left as a documented extension point — see docs/LIMITATIONS.md.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.core.logging_config import get_logger
from app.utils.video_io import VideoMetadata, iter_frames

logger = get_logger(__name__)


@register_analyzer
class SegmentationAnalyzer(BaseAnalyzer):
    name = "segmentation"
    category = "segmentation"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        import mediapipe as mp

        segmenter = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)

        out_dir = self.settings.outputs_dir / "masks" / "segmentation" / Path(video_path).stem
        out_dir.mkdir(parents=True, exist_ok=True)

        frames_out = []
        for idx, ts, frame in iter_frames(video_path):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = segmenter.process(rgb)
            mask = (result.segmentation_mask * 255).astype(np.uint8)

            out_path = out_dir / f"frame_{idx:06d}.png"
            cv2.imwrite(str(out_path), mask)

            coverage = float(np.mean(mask > 127))
            frames_out.append({
                "frame": idx, "timestamp_sec": round(ts, 3),
                "mask_path": str(out_path), "foreground_coverage": round(coverage, 4),
            })

        segmenter.close()
        return {"frame_count_analyzed": len(frames_out), "frames": frames_out}
