"""Transcribe a local audio file with faster-whisper and print one JSON result."""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: transcribe.py <audio-file>", file=sys.stderr)
        return 2

    audio_path = Path(sys.argv[1])
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        return 2

    try:
        from faster_whisper import WhisperModel

        model_name = os.getenv("WHISPER_MODEL", "tiny")
        cpu_threads = int(os.getenv("WHISPER_CPU_THREADS", "4"))

        # CPU + INT8 keeps memory use lower on laptops without a dedicated GPU.
        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8",
            cpu_threads=max(1, cpu_threads),
            num_workers=1,
        )

        segments, info = model.transcribe(
            str(audio_path),
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        # faster-whisper returns a generator; iterating runs transcription.
        transcript_parts = [segment.text.strip() for segment in segments if segment.text.strip()]
        result = {
            "text": " ".join(transcript_parts).strip(),
            "language": getattr(info, "language", None),
            "language_probability": getattr(info, "language_probability", None),
            "model": model_name,
        }
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:  # Report a useful error to the Electron process.
        print(f"Transcription failed: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
