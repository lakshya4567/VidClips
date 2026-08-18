# video_ai_project

Analyzes a video and reconstructs as much editable structure as possible —
scene cuts, camera motion, objects/tracking, text/OCR, human segmentation,
depth, color grading, and audio (transcript, diarization, beats) — into a
set of structured JSON files plus extracted assets (masks, mattes, audio).

See **[docs/LIMITATIONS.md](docs/LIMITATIONS.md)** for exactly what's a real
model-backed implementation vs. a documented extension point — read that
before assuming full feature-list coverage.

## Quickstart

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                     # edit as needed

# also required on PATH: ffmpeg
```

### Run on a single video (CLI)
```bash
python scripts/analyze_video.py path/to/video.mp4
python scripts/analyze_video.py path/to/video.mp4 --analyzers scene_detection,object_detection
```
Outputs land in `outputs/metadata/<run_id>/` — see `project.json` for a
manifest linking every other file (`timeline.json`, `camera.json`,
`objects.json`, `tracking.json`, `subtitles.json`, `depth.json`,
`color.json`, `audio.json`, `keyframes.json`, `transitions.json`,
`scene_data.json`).

### Run the API
```bash
uvicorn app.main:app --reload
# POST /jobs         (multipart file upload) -> starts analysis in background
# GET  /jobs/{id}     -> status + output file paths once complete
# GET  /analyzers      -> list available analyzers
```
Interactive docs at `http://localhost:8000/docs`.

### Run the local UI
```bash
python -m app.services.gradio_app
# open http://localhost:7860
```

### Docker
```bash
docker compose up --build
```
Requires the NVIDIA Container Toolkit for GPU access; drop the `deploy.resources`
block in `docker-compose.yml` and switch the Dockerfile base image to
`python:3.11-slim` for CPU-only.

## Architecture

```
app/
├── analyzers/     # one file per capability, plugin-style (see base.py)
├── api/           # FastAPI routes
├── config/        # pydantic Settings (.env-driven)
├── core/          # logging, exceptions
├── database/      # SQLite job tracking (SQLAlchemy)
├── exporters/     # PipelineRun -> the JSON files the spec asks for
├── pipelines/      # orchestrator: runs all enabled analyzers concurrently
├── services/       # model registry (lazy load + auto-download), job service, Gradio UI
└── utils/          # video I/O helpers
```

**Adding a new analyzer** (e.g. one of the extension points in
`docs/LIMITATIONS.md`):
1. Create `app/analyzers/your_thing.py`, subclass `BaseAnalyzer`, implement `run()`.
2. Decorate the class with `@register_analyzer`.
3. Import it in `app/analyzers/__init__.py`.
4. (Optional) add an `enable_your_thing` flag to `Settings` and a filename
   mapping in `app/exporters/json_exporter.py`.

No other file needs to change — the pipeline runner and API pick it up
via the registry automatically.

## Testing
```bash
pytest                       # fast tests, no models/GPU required
pytest -m slow --run-slow    # integration tests against real models (needs tests/fixtures/sample.mp4)
```

## Known constraints
- First run of each analyzer downloads its model weights (YOLOv8, MiDaS,
  Whisper, etc.) — expect a delay and disk usage on first use; cached
  afterward under `checkpoints/` and the relevant library's cache dir.
- `pyannote` speaker diarization requires accepting its model license on
  HuggingFace and setting `HF_TOKEN` in `.env`.
- GPU strongly recommended for `object_detection`, `depth`, and `audio`
  (Whisper) at anything beyond short clips; all analyzers fall back to CPU.
