"""
tests/test_analyzers.py

Integration tests that require actual model downloads (and ideally a
GPU) to run in reasonable time. Excluded from the default `pytest`
run; execute explicitly with:

    pytest tests/test_analyzers.py -m slow --run-slow

You'll need a short sample video at tests/fixtures/sample.mp4 (not
included in this scaffold — add your own small clip, a few seconds is
enough).
"""
from __future__ import annotations

from pathlib import Path

import pytest

FIXTURE = Path(__file__).parent / "fixtures" / "sample.mp4"

pytestmark = pytest.mark.slow


def _require_fixture():
    if not FIXTURE.exists():
        pytest.skip(f"Add a short sample video at {FIXTURE} to run this test.")


def test_scene_detection_runs():
    _require_fixture()
    from app.analyzers.scene_detection import SceneDetectionAnalyzer
    from app.config.settings import settings
    from app.utils.video_io import probe_video

    analyzer = SceneDetectionAnalyzer(settings=settings, device="cpu")
    metadata = probe_video(str(FIXTURE))
    result = analyzer.run(str(FIXTURE), metadata)
    assert "scenes" in result
    assert result["scene_count"] >= 1


def test_camera_motion_runs():
    _require_fixture()
    from app.analyzers.camera_motion import CameraMotionAnalyzer
    from app.config.settings import settings
    from app.utils.video_io import probe_video

    analyzer = CameraMotionAnalyzer(settings=settings, device="cpu")
    metadata = probe_video(str(FIXTURE))
    result = analyzer.run(str(FIXTURE), metadata)
    assert "frames" in result


def test_full_pipeline_end_to_end():
    _require_fixture()
    from app.pipelines.video_pipeline import run_pipeline

    run = run_pipeline(str(FIXTURE), analyzer_names=["scene_detection", "camera_motion"])
    assert run.results["scene_detection"].status in ("ok", "failed")
