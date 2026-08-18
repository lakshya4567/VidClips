"""
app/core/exceptions.py

Typed exceptions used across the app. Catching `AnalyzerError` at the
pipeline-runner level (rather than bare `Exception`) lets one analyzer
fail without killing the whole job, while still surfacing real bugs
(e.g. `ConfigError`) loudly.
"""


class VideoAIError(Exception):
    """Base class for all application errors."""


class ConfigError(VideoAIError):
    """Raised when configuration is invalid or missing."""


class ModelLoadError(VideoAIError):
    """Raised when a model checkpoint fails to load or download."""


class AnalyzerError(VideoAIError):
    """Raised when a single analyzer fails to process a video/frame."""

    def __init__(self, analyzer_name: str, message: str, *, recoverable: bool = True):
        self.analyzer_name = analyzer_name
        self.recoverable = recoverable
        super().__init__(f"[{analyzer_name}] {message}")


class MediaReadError(VideoAIError):
    """Raised when a video/audio file can't be opened or decoded."""


class ExportError(VideoAIError):
    """Raised when writing an output artifact (JSON, mask, clip) fails."""
