"""
tests/test_core.py

Deliberately scoped to logic that doesn't require downloading models
or GPU access, so `pytest` runs cleanly in CI / on any laptop.
ML-model-dependent analyzers should get integration tests marked
`@pytest.mark.slow` / `@pytest.mark.gpu` (see tests/test_analyzers.py)
and be excluded from the default CI run.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.analyzers.base import (
    ANALYZER_REGISTRY,
    AnalyzerResult,
    BaseAnalyzer,
    register_analyzer,
)
from app.core.exceptions import AnalyzerError
from app.pipelines.video_pipeline import PipelineRun
from app.utils.video_io import VideoMetadata


def test_settings_creates_output_dirs():
    from app.config.settings import settings

    for sub in ("videos", "frames", "masks", "audio", "objects", "effects", "metadata", "previews"):
        assert (settings.outputs_dir / sub).is_dir()


def test_analyzer_registration_and_safe_run():
    calls = {}

    @register_analyzer
    class _DummyAnalyzer(BaseAnalyzer):
        name = "test_dummy"

        def run(self, video_path, metadata):
            calls["ran"] = True
            return {"ok": True}

    assert "test_dummy" in ANALYZER_REGISTRY

    from app.config.settings import settings

    analyzer = _DummyAnalyzer(settings=settings, device="cpu")
    result = analyzer.safe_run("fake.mp4", VideoMetadata("fake.mp4", 1920, 1080, 30.0, 90, 3.0, "h264"))

    assert calls.get("ran") is True
    assert result.status == "ok"
    assert result.data == {"ok": True}
    del ANALYZER_REGISTRY["test_dummy"]


def test_analyzer_safe_run_catches_exceptions():
    @register_analyzer
    class _FailingAnalyzer(BaseAnalyzer):
        name = "test_failing"

        def run(self, video_path, metadata):
            raise ValueError("boom")

    from app.config.settings import settings

    analyzer = _FailingAnalyzer(settings=settings, device="cpu")
    result = analyzer.safe_run("fake.mp4", VideoMetadata("fake.mp4", 1920, 1080, 30.0, 90, 3.0, "h264"))

    assert result.status == "failed"
    assert "boom" in result.error
    del ANALYZER_REGISTRY["test_failing"]


def test_json_exporter_writes_expected_files(tmp_path: Path):
    from app.exporters.json_exporter import export_run

    metadata = VideoMetadata("fake.mp4", 1920, 1080, 30.0, 90, 3.0, "h264")
    run = PipelineRun(run_id="testrun", video_path="fake.mp4", metadata=metadata)
    run.results["scene_detection"] = AnalyzerResult(
        "scene_detection", "ok", 0.01,
        data={"scene_count": 1, "scenes": [{"scene_index": 0, "start_sec": 0.0, "end_sec": 3.0,
                                              "start_frame": 0, "end_frame": 90, "duration_sec": 3.0}]},
    )

    written = export_run(run, output_dir=tmp_path)

    assert (tmp_path / "project.json").exists()
    assert (tmp_path / "scene_data.json").exists()
    assert (tmp_path / "timeline.json").exists()

    with open(tmp_path / "project.json") as f:
        project = json.load(f)
    assert project["run_id"] == "testrun"
    assert project["analyzers"]["scene_detection"]["status"] == "ok"


def test_exception_hierarchy():
    err = AnalyzerError("some_analyzer", "did not work")
    assert "some_analyzer" in str(err)
    assert err.recoverable is True
