"""
app/analyzers/object_detection.py

Runs YOLOv8 (via ultralytics) with its built-in ByteTrack tracker
enabled, so detections carry stable `track_id`s across frames. This
feeds both `objects.json` (per-object bounding boxes over time) and
`tracking.json` (the same data keyed by track_id for motion-tracking
consumers, e.g. an NLE import script).
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.services.model_registry import model_registry
from app.utils.video_io import VideoMetadata


@register_analyzer
class ObjectDetectionAnalyzer(BaseAnalyzer):
    name = "object_detection"
    category = "detection"
    requires_gpu = True

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        model = model_registry.get("yolo_detector")

        results = model.track(
            source=video_path,
            stream=True,
            persist=True,
            tracker="bytetrack.yaml",
            device=self.device,
            verbose=False,
        )

        detections_by_frame = []
        tracks: dict[int, list[dict]] = defaultdict(list)

        for frame_idx, result in enumerate(results):
            ts = frame_idx / metadata.fps if metadata.fps else 0.0
            frame_dets = []
            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    label = model.names.get(cls_id, str(cls_id))
                    conf = float(box.conf[0])
                    xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]
                    track_id = int(box.id[0]) if box.id is not None else None

                    det = {
                        "label": label, "confidence": round(conf, 4),
                        "bbox_xyxy": xyxy, "track_id": track_id,
                    }
                    frame_dets.append(det)
                    if track_id is not None:
                        tracks[track_id].append({
                            "frame": frame_idx, "timestamp_sec": round(ts, 3),
                            "bbox_xyxy": xyxy, "label": label, "confidence": round(conf, 4),
                        })

            detections_by_frame.append({
                "frame": frame_idx, "timestamp_sec": round(ts, 3), "detections": frame_dets,
            })

        track_summary = [
            {
                "track_id": tid,
                "label": path[0]["label"] if path else None,
                "first_seen_sec": path[0]["timestamp_sec"] if path else None,
                "last_seen_sec": path[-1]["timestamp_sec"] if path else None,
                "path": path,
            }
            for tid, path in tracks.items()
        ]

        return {
            "frame_count_analyzed": len(detections_by_frame),
            "detections": detections_by_frame,
            "tracks": track_summary,
        }
