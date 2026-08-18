"""
app/analyzers/base.py

Every analyzer (scene detection, object detection, OCR, audio, ...) is
a plugin implementing `BaseAnalyzer`. This gives us:

  - A uniform way to run any subset of analyzers over a video.
  - A uniform result shape that exporters can serialize without
    knowing which analyzer produced it.
  - A registry (`ANALYZER_REGISTRY`) so new analyzers can be dropped
    into `app/analyzers/` and picked up automatically without editing
    the pipeline runner (see `register_analyzer`).

To add a new capability from the spec that isn't implemented yet:
  1. Create app/analyzers/<name>.py
  2. Subclass BaseAnalyzer, implement `run()`
  3. Decorate the class with @register_analyzer
  4. Add an `enable_<name>` flag to Settings if it should be toggleable
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable

from app.core.exceptions import AnalyzerError
from app.core.logging_config import get_logger
from app.utils.video_io import VideoMetadata

logger = get_logger(__name__)


@dataclass
class AnalyzerResult:
    analyzer_name: str
    status: str  # "ok" | "skipped" | "failed"
    duration_sec: float
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BaseAnalyzer(ABC):
    """Subclass this for every video/audio analysis capability."""

    name: str = "base"
    requires_gpu: bool = False
    category: str = "general"  # detection|segmentation|tracking|audio|depth|ocr|effects|color

    def __init__(self, settings, device: str):
        self.settings = settings
        self.device = device
        self._model = None  # lazy-loaded on first use

    def is_enabled(self) -> bool:
        """Analyzers can override; defaults to checking `enable_<name>` on settings."""
        return getattr(self.settings, f"enable_{self.name}", True)

    @abstractmethod
    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        """Run the analysis and return a JSON-serializable dict."""

    def safe_run(self, video_path: str, metadata: VideoMetadata) -> AnalyzerResult:
        if not self.is_enabled():
            return AnalyzerResult(self.name, "skipped", 0.0)
        start = time.perf_counter()
        try:
            data = self.run(video_path, metadata)
            return AnalyzerResult(self.name, "ok", time.perf_counter() - start, data=data)
        except Exception as exc:  # noqa: BLE001 - intentionally broad, isolates plugin failures
            logger.exception("Analyzer '%s' failed", self.name)
            return AnalyzerResult(
                self.name, "failed", time.perf_counter() - start,
                error=str(AnalyzerError(self.name, str(exc))),
            )


ANALYZER_REGISTRY: dict[str, type[BaseAnalyzer]] = {}


def register_analyzer(cls: type[BaseAnalyzer]) -> type[BaseAnalyzer]:
    """Class decorator: adds an analyzer to the global registry by `.name`."""
    if not cls.name or cls.name == "base":
        raise ValueError(f"{cls.__name__} must define a unique `name`")
    ANALYZER_REGISTRY[cls.name] = cls
    return cls


def get_registered_analyzers() -> dict[str, type[BaseAnalyzer]]:
    return dict(ANALYZER_REGISTRY)
