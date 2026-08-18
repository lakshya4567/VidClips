#!/usr/bin/env python
"""
scripts/analyze_video.py

Command-line entrypoint for running the pipeline on a single video
without starting the API or UI. Useful for batch jobs / CI.

Usage:
    python scripts/analyze_video.py path/to/video.mp4
    python scripts/analyze_video.py path/to/video.mp4 --analyzers scene_detection,object_detection
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.job_service import run_job  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the video AI pipeline on a single file.")
    parser.add_argument("video_path", type=str, help="Path to the input video file")
    parser.add_argument(
        "--analyzers", type=str, default=None,
        help="Comma-separated analyzer names to run (default: all enabled)",
    )
    args = parser.parse_args()

    if not Path(args.video_path).exists():
        print(f"File not found: {args.video_path}", file=sys.stderr)
        sys.exit(1)

    names = args.analyzers.split(",") if args.analyzers else None
    run_id = run_job(args.video_path, analyzer_names=names)
    print(f"Run complete: {run_id}")
    print(f"See outputs/metadata/{run_id}/project.json for the manifest.")


if __name__ == "__main__":
    main()
