"""
app/analyzers/depth_estimation.py

Per-frame monocular relative-depth estimation via MiDaS-small. Full
depth maps are large, so this analyzer writes each sampled frame's
depth map as a 16-bit PNG to outputs/masks/depth/ and records only
the file path + summary stats (near/far/mean) in depth.json. This
mirrors how the other mask-producing analyzers (segmentation) should
behave: heavy binary data on disk, lightweight pointers in JSON.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.services.model_registry import model_registry
from app.utils.video_io import VideoMetadata, iter_frames


@register_analyzer
class DepthEstimationAnalyzer(BaseAnalyzer):
    name = "depth"
    category = "depth"
    requires_gpu = True

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        import torch

        model = model_registry.get("depth_model")
        transforms = torch.hub.load("intel-isl/MiDaS", "transforms").small_transform

        out_dir = self.settings.outputs_dir / "masks" / "depth" / Path(video_path).stem
        out_dir.mkdir(parents=True, exist_ok=True)

        frames_out = []
        # Depth is expensive; sample more sparsely than other analyzers
        # by tripling the configured stride unless the user set stride>1 already.
        stride = max(self.settings.frame_sample_stride, 1) * 3

        for idx, ts, frame in iter_frames(video_path, stride=stride):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            input_batch = transforms(rgb).to(self.device)

            with torch.no_grad():
                prediction = model(input_batch)
                prediction = torch.nn.functional.interpolate(
                    prediction.unsqueeze(1), size=rgb.shape[:2],
                    mode="bicubic", align_corners=False,
                ).squeeze()

            depth = prediction.cpu().numpy()
            depth_norm = cv2.normalize(depth, None, 0, 65535, cv2.NORM_MINMAX).astype(np.uint16)

            out_path = out_dir / f"frame_{idx:06d}.png"
            cv2.imwrite(str(out_path), depth_norm)

            frames_out.append({
                "frame": idx, "timestamp_sec": round(ts, 3),
                "depth_map_path": str(out_path),
                "near": float(np.min(depth)), "far": float(np.max(depth)),
                "mean": float(np.mean(depth)),
            })

        return {"frame_count_analyzed": len(frames_out), "frames": frames_out}
