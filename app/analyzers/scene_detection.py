"""
app/analyzers/scene_detection.py

Detects hard cuts / scene boundaries using PySceneDetect's
content-aware detector (frame-to-frame HSV histogram delta). Produces
the data that backs `scene_data.json` and seeds the master
`timeline.json` with segment boundaries other analyzers key off of.
"""
from __future__ import annotations

from typing import Any

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.utils.video_io import VideoMetadata


@register_analyzer
class SceneDetectionAnalyzer(BaseAnalyzer):
    name = "scene_detection"
    category = "detection"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        from scenedetect import ContentDetector, SceneManager, open_video

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=27.0))
        scene_manager.detect_scenes(video, show_progress=False)
        scene_list = scene_manager.get_scene_list()

        scenes = []
        for i, (start, end) in enumerate(scene_list):
            scenes.append({
                "scene_index": i,
                "start_frame": start.get_frames(),
                "end_frame": end.get_frames(),
                "start_sec": round(start.get_seconds(), 3),
                "end_sec": round(end.get_seconds(), 3),
                "duration_sec": round(end.get_seconds() - start.get_seconds(), 3),
            })

        # Fallback: no cuts detected -> whole video is one scene
        if not scenes:
            scenes = [{
                "scene_index": 0, "start_frame": 0, "end_frame": metadata.frame_count,
                "start_sec": 0.0, "end_sec": metadata.duration_sec,
                "duration_sec": metadata.duration_sec,
            }]

        return {"scene_count": len(scenes), "scenes": scenes}
