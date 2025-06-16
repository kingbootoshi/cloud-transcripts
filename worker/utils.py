
from datetime import timedelta
from pathlib import Path
from typing import Dict, Any, List

def _fmt(ts: float) -> str:
    """HH:MM:SS zero-padded timestamp."""
    return str(timedelta(seconds=int(ts)))

def _append_full_transcript(lines: List[str], segments: List[Dict[str, Any]]) -> None:
    lines.append("# Full Transcript\n")
    last_speaker: str | None = None

    for seg in segments:
        speaker = seg.get("speaker", "UNKNOWN")
        text = seg["text"].strip()

        if speaker != last_speaker:
            if last_speaker is not None:
                lines.append("")  # blank line between turns
            lines.append(f"**{speaker}:** {text}")
        else:
            lines[-1] += f" {text}"  # same speaker → continue paragraph

        last_speaker = speaker

    lines.append("")  # trailing blank line


def _append_segment_blocks(lines: List[str], segments: List[Dict[str, Any]]) -> None:
    lines.append("# Timestamped Transcript\n")

    for idx, seg in enumerate(segments, 1):
        start, end = _fmt(seg["start"]), _fmt(seg["end"])
        speaker = seg.get("speaker", "UNKNOWN")

        # ▸ Segment header + plain text
        lines += [
            f"## Segment {idx}: [{start} - {end}] ({speaker})\n",
            seg["text"].strip(),
            "",
        ]

        # ▸ Word-level table
        if not seg.get("words"):
            continue

        lines.append("### Word-level timestamps\n")

        current_speaker: str | None = None
        for w in seg["words"]:
            w_speaker = w.get("speaker", speaker)
            if w_speaker != current_speaker:
                lines.append(f"\n**{w_speaker}:**")       # new speaker subsection
                current_speaker = w_speaker
            lines.append(f"- {w['word'].strip()} @ {_fmt(w['start'])}")

        lines.append("")  # blank line after each word table


def write_markdown(result: Dict[str, Any], output_path: Path) -> None:
    """
    Write a markdown transcript with:
      • speaker-labelled ‘Full Transcript’
      • per-segment blocks
      • nested word-level timestamps
      • summary footer
    """
    segments = result.get("segments", [])
    if not segments:
        raise ValueError("No segments found in WhisperX result")

    md: list[str] = []

    _append_full_transcript(md, segments)
    _append_segment_blocks(md, segments)

    # ► Summary
    md += [
        "## Summary",
        "",
        f"Total segments: {len(segments)}",
        f"Total duration: {_fmt(segments[-1]['end'] - segments[0]['start'])}",
        "",
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(md), encoding="utf-8")