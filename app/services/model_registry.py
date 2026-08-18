"""
app/services/model_registry.py

Central place that knows how to obtain every model checkpoint the app
uses. Analyzers call `model_registry.get(name)` instead of hardcoding
download URLs / cache paths, so:

  - Models are downloaded once and cached under `settings.checkpoints_dir`.
  - Swapping a model implementation means editing one entry here.
  - `auto_download_models=False` fails fast with a clear error instead
    of a confusing crash three layers down in a forward pass.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from app.config.settings import settings
from app.core.exceptions import ModelLoadError
from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ModelSpec:
    name: str
    loader: Callable[[], Any]  # zero-arg callable that returns a ready-to-use model object
    description: str = ""


class ModelRegistry:
    """Thread-safe lazy singleton cache for loaded model objects."""

    def __init__(self) -> None:
        self._specs: dict[str, ModelSpec] = {}
        self._instances: dict[str, Any] = {}
        self._lock = threading.Lock()

    def register(self, name: str, loader: Callable[[], Any], description: str = "") -> None:
        self._specs[name] = ModelSpec(name, loader, description)

    def get(self, name: str) -> Any:
        if name in self._instances:
            return self._instances[name]
        with self._lock:
            if name in self._instances:  # re-check after acquiring lock
                return self._instances[name]
            if name not in self._specs:
                raise ModelLoadError(f"No model registered under '{name}'")
            if not settings.auto_download_models:
                logger.warning(
                    "auto_download_models is False; '%s' will only load if "
                    "already cached locally.", name,
                )
            spec = self._specs[name]
            logger.info("Loading model '%s' (%s)...", name, spec.description)
            try:
                instance = spec.loader()
            except Exception as exc:  # noqa: BLE001
                raise ModelLoadError(f"Failed to load model '{name}': {exc}") from exc
            self._instances[name] = instance
            logger.info("Model '%s' loaded.", name)
            return instance

    def is_loaded(self, name: str) -> bool:
        return name in self._instances

    def checkpoint_path(self, filename: str) -> Path:
        return settings.checkpoints_dir / filename


model_registry = ModelRegistry()


def _register_defaults() -> None:
    """
    Registers loaders for every model the built-in analyzers use.
    Each loader is only invoked the first time it's actually needed
    (lazy), so `import app.services.model_registry` stays cheap and
    machines without a GPU/network don't pay any cost until a
    specific analyzer runs.
    """

    def _load_yolo():
        from ultralytics import YOLO

        weights = model_registry.checkpoint_path("yolov8n.pt")
        # ultralytics auto-downloads to cwd/checkpoints if not present
        return YOLO(str(weights) if weights.exists() else "yolov8n.pt")

    def _load_easyocr():
        import easyocr

        return easyocr.Reader(["en"], gpu=(settings.resolved_device() == "cuda"))

    def _load_mediapipe_face():
        import mediapipe as mp

        return mp.solutions.face_detection.FaceDetection(min_detection_confidence=0.5)

    def _load_mediapipe_pose():
        import mediapipe as mp

        return mp.solutions.pose.Pose(static_image_mode=False)

    def _load_mediapipe_hands():
        import mediapipe as mp

        return mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=4)

    def _load_depth_model():
        import torch

        model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
        model.to(settings.resolved_device()).eval()
        return model

    def _load_whisper():
        import whisper

        return whisper.load_model("base")

    def _load_diarization():
        from pyannote.audio import Pipeline

        return Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")

    model_registry.register("yolo_detector", _load_yolo, "YOLOv8n object detection")
    model_registry.register("easyocr_reader", _load_easyocr, "EasyOCR text detection/OCR")
    model_registry.register("face_detector", _load_mediapipe_face, "MediaPipe face detection")
    model_registry.register("pose_estimator", _load_mediapipe_pose, "MediaPipe pose estimation")
    model_registry.register("hand_tracker", _load_mediapipe_hands, "MediaPipe hand tracking")
    model_registry.register("depth_model", _load_depth_model, "MiDaS small monocular depth")
    model_registry.register("whisper_asr", _load_whisper, "OpenAI Whisper speech-to-text")
    model_registry.register("diarization", _load_diarization, "pyannote speaker diarization")


_register_defaults()
