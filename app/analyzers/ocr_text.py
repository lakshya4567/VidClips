"""
app/analyzers/ocr_text.py

Text detection + OCR via EasyOCR.
"""
from __future__ import annotations

from typing import Any

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.services.model_registry import model_registry
from app.utils.video_io import VideoMetadata, iter_frames


def _boxes_close(a: list, b: list, tol: int = 15) -> bool:
    return all(
        abs(a[i][0] - b[i][0]) < tol and
        abs(a[i][1] - b[i][1]) < tol
        for i in range(len(a))
    )


@register_analyzer
class OCRTextAnalyzer(BaseAnalyzer):
    name = "ocr"
    category = "ocr"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        print("=" * 60)
        print("OCR ANALYZER STARTED")
        print("=" * 60)

        reader = model_registry.get("easyocr_reader")
        print("EasyOCR model loaded")

        raw_events: list[dict] = []

        total_frames = metadata.frame_count
        print(f"Total frames: {total_frames}")

        for i, (idx, ts, frame) in enumerate(iter_frames(video_path), start=1):

            # Print every 50 frames
            if i % 50 == 0:
                print(f"OCR processing frame {idx}/{total_frames}")

            results = reader.readtext(frame)

            for bbox, text, conf in results:
                if conf < 0.4:
                    continue

                if not text.strip():
                    continue

                raw_events.append(
                    {
                        "frame": idx,
                        "timestamp_sec": round(ts, 3),
                        "text": text,
                        "confidence": round(float(conf), 4),
                        "bbox": [
                            [round(x, 1), round(y, 1)]
                            for x, y in bbox
                        ],
                    }
                )

        print("Finished reading all frames.")
        print(f"Raw OCR detections: {len(raw_events)}")

        events: list[dict] = []
        active: dict[str, dict] = {}
        seen_this_frame: set[str] = set()

        frames_seen = sorted(set(e["frame"] for e in raw_events))

        print("Grouping OCR events...")

        for f in frames_seen:

            seen_this_frame.clear()

            frame_events = [
                e for e in raw_events
                if e["frame"] == f
            ]

            for e in frame_events:

                key = e["text"]
                seen_this_frame.add(key)

                if (
                    key in active and
                    _boxes_close(active[key]["bbox"], e["bbox"])
                ):
                    active[key]["end_sec"] = e["timestamp_sec"]
                    active[key]["end_frame"] = e["frame"]

                elif key in active:
                    active[key]["animated"] = True
                    active[key]["end_sec"] = e["timestamp_sec"]
                    active[key]["end_frame"] = e["frame"]
                    active[key]["bbox"] = e["bbox"]

                else:
                    active[key] = {
                        "text": e["text"],
                        "start_sec": e["timestamp_sec"],
                        "end_sec": e["timestamp_sec"],
                        "start_frame": e["frame"],
                        "end_frame": e["frame"],
                        "bbox": e["bbox"],
                        "confidence": e["confidence"],
                        "animated": False,
                    }

            for key in list(active):
                if key not in seen_this_frame:
                    events.append(active.pop(key))

        events.extend(active.values())

        print(f"Grouped into {len(events)} text events")
        print("OCR ANALYZER FINISHED")
        print("=" * 60)

        return {
            "text_event_count": len(events),
            "text_events": events,
        }