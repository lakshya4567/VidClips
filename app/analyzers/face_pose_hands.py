"""
app/analyzers/face_pose_hands.py

Human-centric landmark analysis via MediaPipe: face bounding boxes,
33-point body pose, and 21-point-per-hand tracking. Sampled at
`settings.frame_sample_stride` since landmark models are relatively
cheap but still add up over a full-length video.
"""
from __future__ import annotations

from typing import Any

import cv2

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.services.model_registry import model_registry
from app.utils.video_io import VideoMetadata, iter_frames


@register_analyzer
class FacePoseHandsAnalyzer(BaseAnalyzer):
    name = "face_pose"
    category = "detection"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        face_model = model_registry.get("face_detector")
        pose_model = model_registry.get("pose_estimator")
        hand_model = model_registry.get("hand_tracker")

        frames_out = []
        for idx, ts, frame in iter_frames(video_path):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            entry: dict[str, Any] = {"frame": idx, "timestamp_sec": round(ts, 3)}

            faces = face_model.process(rgb)
            entry["faces"] = [
                {
                    "confidence": round(det.score[0], 4),
                    "bbox_relative": {
                        "x": round(det.location_data.relative_bounding_box.xmin, 4),
                        "y": round(det.location_data.relative_bounding_box.ymin, 4),
                        "w": round(det.location_data.relative_bounding_box.width, 4),
                        "h": round(det.location_data.relative_bounding_box.height, 4),
                    },
                }
                for det in (faces.detections or [])
            ]

            pose = pose_model.process(rgb)
            entry["pose_landmarks"] = (
                [
                    {"x": round(lm.x, 4), "y": round(lm.y, 4), "z": round(lm.z, 4),
                     "visibility": round(lm.visibility, 4)}
                    for lm in pose.pose_landmarks.landmark
                ]
                if pose.pose_landmarks else None
            )

            hands = hand_model.process(rgb)
            entry["hands"] = (
                [
                    [{"x": round(lm.x, 4), "y": round(lm.y, 4), "z": round(lm.z, 4)} for lm in hand.landmark]
                    for hand in hands.multi_hand_landmarks
                ]
                if hands.multi_hand_landmarks else []
            )

            frames_out.append(entry)

        return {"frame_count_analyzed": len(frames_out), "frames": frames_out}
