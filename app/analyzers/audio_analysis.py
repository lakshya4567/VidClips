"""
app/analyzers/audio_analysis.py

Audio-track analysis pipeline:
  1. Extract the audio track to WAV via ffmpeg (outputs/audio/).
  2. Transcribe speech with Whisper -> subtitles.json source data.
  3. Speaker diarization with pyannote -> "who spoke when".
  4. librosa: tempo/BPM, beat timestamps, RMS-based silence detection.

Music-source-separation (isolating music/SFX/ambience from voice into
separate stems, e.g. via Demucs) and full music-key detection are
documented extension points rather than implemented here — they need
their own heavyweight model downloads and are commonly a separate job
in real pipelines. See docs/LIMITATIONS.md.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import librosa
import numpy as np

from app.analyzers.base import BaseAnalyzer, register_analyzer
from app.core.exceptions import MediaReadError
from app.core.logging_config import get_logger
from app.services.model_registry import model_registry
from app.utils.video_io import VideoMetadata

logger = get_logger(__name__)


def _extract_audio(video_path: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{Path(video_path).stem}.wav"
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not out_path.exists():
        raise MediaReadError(f"ffmpeg audio extraction failed: {result.stderr[-500:]}")
    return out_path


@register_analyzer
class AudioAnalyzer(BaseAnalyzer):
    name = "audio"
    category = "audio"
    requires_gpu = False

    def run(self, video_path: str, metadata: VideoMetadata) -> dict[str, Any]:
        audio_out_dir = self.settings.outputs_dir / "audio"
        try:
            wav_path = _extract_audio(video_path, audio_out_dir)
        except MediaReadError as exc:
            logger.warning("No audio track or extraction failed: %s", exc)
            return {"has_audio": False, "reason": str(exc)}

        result: dict[str, Any] = {"has_audio": True, "audio_path": str(wav_path)}

        # --- Transcription ---
        try:
            whisper_model = model_registry.get("whisper_asr")
            transcription = whisper_model.transcribe(str(wav_path), verbose=False)
            result["transcript"] = {
                "language": transcription.get("language"),
                "text": transcription.get("text", "").strip(),
                "segments": [
                    {
                        "start_sec": round(seg["start"], 2), "end_sec": round(seg["end"], 2),
                        "text": seg["text"].strip(),
                    }
                    for seg in transcription.get("segments", [])
                ],
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Transcription failed: %s", exc)
            result["transcript"] = {"error": str(exc)}

        # --- Speaker diarization ---
        try:
            diarization_model = model_registry.get("diarization")
            diarization = diarization_model(str(wav_path))
            speakers = [
                {"speaker": speaker, "start_sec": round(turn.start, 2), "end_sec": round(turn.end, 2)}
                for turn, _, speaker in diarization.itertracks(yield_label=True)
            ]
            result["speaker_diarization"] = speakers
        except Exception as exc:  # noqa: BLE001
            logger.warning("Diarization failed (often requires a HF auth token): %s", exc)
            result["speaker_diarization"] = {"error": str(exc)}

        # --- Beat / BPM / silence via librosa ---
        try:
            y, sr = librosa.load(str(wav_path), sr=None, mono=True)
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)

            # Silence detection: RMS energy below a floor for >0.3s
            rms = librosa.feature.rms(y=y)[0]
            rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
            silence_floor = np.percentile(rms, 10)
            is_silent = rms < silence_floor

            silences = []
            start_idx = None
            for i, silent in enumerate(is_silent):
                if silent and start_idx is None:
                    start_idx = i
                elif not silent and start_idx is not None:
                    dur = rms_times[i] - rms_times[start_idx]
                    if dur > 0.3:
                        silences.append({
                            "start_sec": round(float(rms_times[start_idx]), 2),
                            "end_sec": round(float(rms_times[i]), 2),
                        })
                    start_idx = None

            result["music"] = {
                "estimated_bpm": round(float(tempo), 2),
                "beat_timestamps_sec": [round(float(t), 3) for t in beat_times],
            }
            result["silence_segments"] = silences
        except Exception as exc:  # noqa: BLE001
            logger.warning("librosa beat/silence analysis failed: %s", exc)
            result["music"] = {"error": str(exc)}
            result["silence_segments"] = []

        result["note"] = (
            "Voice/music/SFX source separation and music-key detection are "
            "not implemented; see docs/LIMITATIONS.md for the recommended "
            "extension (Demucs for stem separation)."
        )
        return result
