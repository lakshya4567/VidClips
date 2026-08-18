# Implementation status & known limitations

This scaffold implements a real, working subset of the original feature
list end-to-end, plus the architecture (plugin registry, model registry,
pipeline runner, exporters, API/UI/CLI) needed to add the rest. Being
upfront about what's solid vs. approximate vs. not-yet-built:

## Fully implemented, real models/algorithms
| Feature | Analyzer | Method |
|---|---|---|
| Scene cut detection | `scene_detection` | PySceneDetect content-aware detector |
| Pan/tilt/zoom/rotation/shake, motion-blur flag | `camera_motion` | Sparse optical flow + affine transform decomposition |
| Object detection + tracking | `object_detection` | YOLOv8 + ByteTrack |
| Face detection, pose, hand tracking | `face_pose` | MediaPipe |
| Text detection + OCR (incl. basic "animated text" flagging) | `ocr` | EasyOCR + positional diffing across frames |
| Human segmentation / background removal | `segmentation` | MediaPipe Selfie Segmentation (alpha matte PNGs) |
| Monocular relative depth | `depth` | MiDaS-small |
| Color balance / contrast / shadow-highlight tint | `color_grading` | Histogram statistics (HSV/RGB/luma) |
| Speech-to-text (subtitles source) | `audio` | OpenAI Whisper |
| Speaker diarization | `audio` | pyannote.audio (needs a HuggingFace token for the gated model) |
| Beat detection / BPM, silence detection | `audio` | librosa |

## Implemented as a documented approximation, not the literal thing
- **Speed ramps / slow motion**: pixel-only analysis can't reliably recover
  edit-time speed changes without the original constant-frame-rate source;
  `camera_motion` output notes this as a known gap.
- **LUT / color-grade extraction**: `color_grading` outputs a descriptive
  profile (balance, contrast, shadow/highlight tint), not a `.cube` file —
  many different LUTs can produce visually similar pixels, so exact
  recovery is under-determined from rendered output alone.

## Not implemented — documented extension points
These were in the original feature list but are either not standard,
reliable CV tasks, or need their own significant model/engineering effort
beyond a first scaffold. Each has a natural home in `app/analyzers/`:

- **Particle effects (fire, smoke, rain, snow), lens flare, bloom/glow
  detection**: no robust general-purpose detector exists for these as a
  class; a realistic approach is a purpose-trained classifier per effect
  type, which needs labeled data.
- **Watermark / overlay detection**: feasible with a small object-detector
  fine-tuned on your specific watermark set; a generic model would have
  poor precision.
- **Noise/sharpening estimation, denoise-parameter recovery**: possible via
  frequency-domain analysis (FFT band energy, high-frequency variance) as
  a rough signal, not exact filter parameters.
- **Voice / music / SFX source separation**: add `demucs` and a new
  `audio_separation` analyzer; non-trivial compute cost.
- **Music key detection**: add `essentia` or a key-detection model.
- **Instance/semantic segmentation of arbitrary objects** (beyond people):
  add a Segment Anything (SAM) based analyzer.

## Architecture notes
- Every analyzer failing independently is by design (`safe_run` in
  `app/analyzers/base.py`) — one broken model shouldn't kill the whole job.
- Heavy binary outputs (depth maps, mattes) are written to disk under
  `outputs/masks/...` with only paths + summary stats in the JSON, to keep
  the JSON files small and diffable.
- GPU/model downloads only happen lazily, on first real use
  (`app/services/model_registry.py`), so `pip install` + import stays fast
  and CPU-only machines aren't forced to download CUDA-only wheels' worth
  of weights for analyzers they never run.
