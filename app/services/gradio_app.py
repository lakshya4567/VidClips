"""
app/services/gradio_app.py

A local interactive UI as an alternative to the REST API — useful for
demoing or manually inspecting output without writing an HTTP client.

Run:
    python -m app.services.gradio_app
"""
from __future__ import annotations

import json

import gradio as gr

from app.analyzers.base import get_registered_analyzers
from app.services.job_service import run_job


def _analyzer_choices() -> list[str]:
    import app.analyzers  # noqa: F401

    return list(get_registered_analyzers().keys())


def analyze(video_path: str, selected_analyzers: list[str]) -> str:
    if not video_path:
        return "Please upload a video."
    run_id = run_job(video_path, analyzer_names=selected_analyzers or None)
    from app.config.settings import settings

    project_path = settings.outputs_dir / "metadata" / run_id / "project.json"
    if project_path.exists():
        with open(project_path) as f:
            return json.dumps(json.load(f), indent=2)
    return f"Run {run_id} finished but project.json was not found."


def build_app() -> gr.Blocks:
    with gr.Blocks(title="Video AI Reconstruction") as demo:
        gr.Markdown("# Video AI Reconstruction\nUpload a video and select which analyzers to run.")
        with gr.Row():
            video_input = gr.Video(label="Input video")
            analyzer_select = gr.CheckboxGroup(
                choices=_analyzer_choices(), label="Analyzers to run (empty = all enabled)"
            )
        run_button = gr.Button("Run Analysis", variant="primary")
        output_json = gr.Code(label="project.json", language="json")

        run_button.click(fn=analyze, inputs=[video_input, analyzer_select], outputs=output_json)

    return demo


if __name__ == "__main__":
    build_app().launch(server_name="0.0.0.0", server_port=7860)
