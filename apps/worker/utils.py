import datetime
from pathlib import Path
from typing import Dict, List, Any


def format_timestamp(seconds: float) -> str:
    """Convert seconds to mm:ss format"""
    td = datetime.timedelta(seconds=seconds)
    minutes = int(td.total_seconds() // 60)
    seconds = int(td.total_seconds() % 60)
    return f"{minutes:02d}:{seconds:02d}"


def write_markdown(transcript_data: Dict[str, Any], output_path: Path):
    """
    Convert WhisperX JSON output to markdown with word-level timestamps
    and speaker labels
    """
    markdown_lines = ["# Transcript\n"]
    
    # Extract segments
    segments = transcript_data.get("segments", [])
    
    current_speaker = None
    current_paragraph = []
    current_start_time = None
    
    for segment in segments:
        # Get words from segment
        words = segment.get("words", [])
        
        for word in words:
            speaker = word.get("speaker", "UNKNOWN")
            text = word.get("text", "").strip()
            start = word.get("start", 0)
            
            # Skip empty words
            if not text:
                continue
            
            # Handle speaker changes
            if speaker != current_speaker:
                # Write out previous paragraph if exists
                if current_paragraph and current_start_time is not None:
                    timestamp = format_timestamp(current_start_time)
                    speaker_label = f"**{current_speaker}**" if current_speaker else "**UNKNOWN**"
                    paragraph_text = " ".join(current_paragraph)
                    markdown_lines.append(f"\n[{timestamp}] {speaker_label}: {paragraph_text}\n")
                
                # Start new paragraph
                current_speaker = speaker
                current_paragraph = [text]
                current_start_time = start
            else:
                # Continue current paragraph
                current_paragraph.append(text)
    
    # Write final paragraph
    if current_paragraph and current_start_time is not None:
        timestamp = format_timestamp(current_start_time)
        speaker_label = f"**{current_speaker}**" if current_speaker else "**UNKNOWN**"
        paragraph_text = " ".join(current_paragraph)
        markdown_lines.append(f"\n[{timestamp}] {speaker_label}: {paragraph_text}\n")
    
    # Add metadata section
    markdown_lines.extend([
        "\n---\n",
        "\n## Metadata\n",
        f"- Total segments: {len(segments)}\n",
        f"- Duration: {format_timestamp(segments[-1]['end']) if segments else 'N/A'}\n",
        f"- Language: {transcript_data.get('language', 'N/A')}\n"
    ])
    
    # Write to file
    output_path.write_text("\n".join(markdown_lines), encoding="utf-8")