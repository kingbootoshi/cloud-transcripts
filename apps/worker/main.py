import modal
import boto3
import tempfile
import subprocess
import json
import os
import whisperx
import requests
from pathlib import Path
from whisperx.diarize import DiarizationPipeline
from utils import write_markdown
import traceback
import time
from fastapi import Request  # Add at top of file imports area
        
# ---------- Modal Configuration ----------
GPU_TYPE = "H100"
TIMEOUT = 60 * 60 * 6  # 6-hour cap for 4-hour+ media
WEBHOOK = os.environ.get("WEBHOOK_URL", "")
S3 = boto3.client("s3")

app = modal.App(
    "transcript-worker",
    image=(
        modal.Image.from_registry(
            "nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04",
            add_python="3.11",
        )
        .apt_install("ffmpeg", "git")

        # ① CUDA-specific PyTorch wheels — *use the PyTorch index only*
        .pip_install(
            "torch==2.5.1+cu121",
            "torchvision==0.20.1+cu121",
            "torchaudio==2.5.1+cu121",
            index_url="https://download.pytorch.org/whl/cu121",
        )

        # ② Everything else — *default PyPI*
        .pip_install(
            "boto3==1.34.122",
            "fastapi[standard]==0.115.4",
            "requests==2.32.3",
            "whisperx==3.3.4",
            "yt-dlp==2025.6.9",
        )
        .add_local_python_source("utils")
    ),
)

# ---------- Logging Helper ----------
def log_info(message, **kwargs):
    """Structured logging for info messages"""
    log_data = {"level": "info", "message": message, "timestamp": time.time()}
    log_data.update(kwargs)
    print(f"[INFO] {json.dumps(log_data)}")

def log_error(message, error=None, **kwargs):
    """Structured logging for error messages"""
    log_data = {"level": "error", "message": message, "timestamp": time.time()}
    if error:
        log_data["error"] = str(error)
        log_data["traceback"] = traceback.format_exc()
    log_data.update(kwargs)
    print(f"[ERROR] {json.dumps(log_data)}")

def log_debug(message, **kwargs):
    """Structured logging for debug messages"""
    log_data = {"level": "debug", "message": message, "timestamp": time.time()}
    log_data.update(kwargs)
    print(f"[DEBUG] {json.dumps(log_data)}")

# ---------- Helper Functions ----------
def download_from_s3(bucket: str, key: str, out: Path):
    """Download file from S3 to local path"""
    log_info("Starting S3 download", bucket=bucket, key=key, local_path=str(out))
    try:
        S3.download_file(bucket, key, str(out))
        file_size = out.stat().st_size if out.exists() else 0
        log_info("S3 download completed", 
                bucket=bucket, key=key, 
                local_path=str(out), file_size_bytes=file_size)
    except Exception as e:
        log_error("S3 download failed", error=e, bucket=bucket, key=key)
        raise


def has_audio_stream(media_path: Path) -> bool:
    """Return True if the media file contains at least one audio stream."""
    try:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            str(media_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        has_audio = bool(result.stdout.strip())
        log_debug(
            "ffprobe audio stream probe",
            media=str(media_path),
            command=" ".join(cmd),
            stdout=result.stdout.strip(),
            has_audio=has_audio,
        )
        return has_audio
    except subprocess.CalledProcessError as e:
        # ffprobe failed – treat as no audio and log for diagnostics
        log_error(
            "ffprobe failed during audio stream check",
            error=e,
            command=" ".join(e.cmd) if hasattr(e, "cmd") else None,
            stdout=e.stdout,
            stderr=e.stderr,
        )
        return False


def extract_audio(video_path: Path, wav_path: Path):
    """Extract mono 16kHz PCM audio from video"""
    log_info("Starting audio extraction", 
            video_path=str(video_path), audio_path=str(wav_path))
    
    # Ensure the video actually has an audio stream before invoking ffmpeg.
    if not has_audio_stream(video_path):
        log_error(
            "No audio stream found in input video",
            video_path=str(video_path),
        )
        raise ValueError("Input video does not contain an audio track – cannot transcribe.")

    cmd = [
        "ffmpeg", "-i", str(video_path), "-vn",
        "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(wav_path), "-y", "-loglevel", "error"
    ]
    
    try:
        log_debug("Running ffmpeg command", command=" ".join(cmd))
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        # Get audio file info
        audio_size = wav_path.stat().st_size if wav_path.exists() else 0
        log_info("Audio extraction completed", 
                video_path=str(video_path), 
                audio_path=str(wav_path),
                audio_size_bytes=audio_size)
    except subprocess.CalledProcessError as e:
        log_error("FFmpeg audio extraction failed", 
                 error=e, command=" ".join(cmd),
                 stdout=e.stdout, stderr=e.stderr)
        raise
    except Exception as e:
        log_error("Unexpected error during audio extraction", error=e)
        raise


def get_audio_duration(audio_path: Path) -> float:
    """Get duration of audio file in seconds"""
    try:
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        duration = float(result.stdout.strip())
        log_debug("Audio duration detected", audio_path=str(audio_path), duration_seconds=duration)
        return duration
    except Exception as e:
        log_error("Failed to get audio duration", error=e, audio_path=str(audio_path))
        return 0.0


def upload_results(bucket: str, md: Path, js: Path):
    """Upload markdown and JSON results to S3"""
    log_info("Starting results upload to S3", bucket=bucket, 
            markdown_file=str(md), json_file=str(js))
    
    try:
        # Upload markdown
        S3.upload_file(
            str(md), bucket, f"results/{md.name}",
            ExtraArgs={"ContentType": "text/markdown"}
        )
        log_info("Markdown uploaded successfully", 
                bucket=bucket, key=f"results/{md.name}")
        
        # Upload JSON
        S3.upload_file(
            str(js), bucket, f"results/{js.name}",
            ExtraArgs={"ContentType": "application/json"}
        )
        log_info("JSON uploaded successfully", 
                bucket=bucket, key=f"results/{js.name}")
        
        return (f"results/{md.name}", f"results/{js.name}")
    except Exception as e:
        log_error("Failed to upload results to S3", error=e, 
                 bucket=bucket, markdown_file=str(md), json_file=str(js))
        raise


# ---------- GPU Function ----------
@app.function(
    gpu=GPU_TYPE,
    timeout=TIMEOUT,
    secrets=[modal.Secret.from_dotenv()]
)
def transcribe_task(job_json: str):
    """Main transcription task that runs on GPU"""
    start_time = time.time()
    job = None
    
    try:
        job = json.loads(job_json)
        job_id = job.get("job_id", "unknown")
        
        log_info("Transcription job started", 
                job_id=job_id, job_payload=job)
        
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            media_in = tmp_dir / Path(job["object_key"]).name
            wav_path = tmp_dir / (media_in.stem + ".wav")
            
            log_debug("Temporary directory setup", 
                     tmp_dir=str(tmp_dir), 
                     media_file=str(media_in), 
                     audio_file=str(wav_path))
            
            # 1. Download media
            log_info("Step 1: Downloading media from S3", job_id=job_id)
            download_from_s3(job["s3_bucket"], job["object_key"], media_in)
            
            # 2. Extract audio if we were given a video
            log_info("Step 2: Processing audio", job_id=job_id, media_type=job["media_type"])
            if job["media_type"] == "video":
                extract_audio(media_in, wav_path)
            else:
                wav_path = media_in  # already audio
                log_info("Input is already audio, skipping extraction", job_id=job_id)
            
            # Get audio duration for logging
            duration = get_audio_duration(wav_path)
            log_info("Audio ready for transcription", 
                    job_id=job_id, audio_path=str(wav_path), 
                    duration_seconds=duration)
            
            # 3. WhisperX transcription
            log_info("Step 3: Loading WhisperX model", job_id=job_id)
            device = "cuda"
            model_size = job.get("model_size", "large-v2")
            language = job.get("language", "en")
            
            log_debug("WhisperX configuration", 
                     job_id=job_id, model_size=model_size, 
                     language=language, device=device)
            
            try:
                model = whisperx.load_model(
                    model_size,
                    device,
                    compute_type="float16"
                )
                log_info("WhisperX model loaded successfully", 
                        job_id=job_id, model_size=model_size)
            except Exception as e:
                log_error("Failed to load WhisperX model", 
                         error=e, job_id=job_id, model_size=model_size)
                raise
            
            # Transcribe
            log_info("Starting transcription", job_id=job_id)
            try:
                result = model.transcribe(
                    str(wav_path),
                    language=language
                )
                segment_count = len(result.get("segments", []))
                log_info("Transcription completed", 
                        job_id=job_id, segments_found=segment_count)
            except Exception as e:
                log_error("Transcription failed", error=e, job_id=job_id)
                raise
            
            # Align
            log_info("Step 4: Starting word alignment", job_id=job_id)
            try:
                align_model, metadata = whisperx.load_align_model(
                    language_code=language,
                    device=device
                )
                log_info("Alignment model loaded", job_id=job_id, language=language)
                
                result = whisperx.align(
                    result["segments"],
                    align_model,
                    metadata,
                    str(wav_path),
                    device
                )
                log_info("Word alignment completed", job_id=job_id)
            except Exception as e:
                log_error("Word alignment failed", error=e, job_id=job_id)
                raise
            
            # 4. Optional diarization
            do_diarize = job.get("do_diarize", True)
            log_info("Step 5: Speaker diarization", 
                    job_id=job_id, do_diarize=do_diarize)
            
            if do_diarize:
                try:
                    hf_token = os.environ.get("HF_TOKEN")
                    if not hf_token:
                        log_error("HF_TOKEN not found in environment", job_id=job_id)
                        raise ValueError("HF_TOKEN required for diarization")
                    
                    log_debug("HF token available for diarization", 
                             job_id=job_id, token_length=len(hf_token))
                    
                    diarize_model = DiarizationPipeline(
                        use_auth_token=hf_token,
                        device=device
                    )
                    log_info("Diarization pipeline loaded", job_id=job_id)
                    
                    min_speakers = job.get("min_speakers", 2)
                    max_speakers = job.get("max_speakers", 6)
                    
                    log_debug("Running diarization", 
                             job_id=job_id, min_speakers=min_speakers, 
                             max_speakers=max_speakers)
                    
                    diarize_segments = diarize_model(
                        str(wav_path),
                        min_speakers=min_speakers,
                        max_speakers=max_speakers
                    )
                    
                    result = whisperx.assign_word_speakers(diarize_segments, result)
                    log_info("Speaker diarization completed", job_id=job_id)
                    
                except Exception as e:
                    log_error("Speaker diarization failed", 
                             error=e, job_id=job_id)
                    # Continue without diarization rather than failing completely
                    log_info("Continuing without speaker labels", job_id=job_id)
            
            # 5. Serialize outputs
            log_info("Step 6: Generating output files", job_id=job_id)
            md_out = tmp_dir / f"{job['job_id']}.md"
            json_out = tmp_dir / f"{job['job_id']}.json"
            
            try:
                # Write markdown
                log_debug("Writing markdown output", 
                         job_id=job_id, markdown_path=str(md_out))
                write_markdown(result, md_out)
                
                # Write JSON
                log_debug("Writing JSON output", 
                         job_id=job_id, json_path=str(json_out))
                json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
                
                # Verify files were created
                md_size = md_out.stat().st_size if md_out.exists() else 0
                json_size = json_out.stat().st_size if json_out.exists() else 0
                
                log_info("Output files generated", 
                        job_id=job_id, 
                        markdown_size_bytes=md_size,
                        json_size_bytes=json_size)
                
            except Exception as e:
                log_error("Failed to write output files", error=e, job_id=job_id)
                raise
            
            # 6. Upload to S3
            log_info("Step 7: Uploading results to S3", job_id=job_id)
            md_key, json_key = upload_results(job["s3_bucket"], md_out, json_out)
            
            # 7. Callback
            log_info("Step 8: Sending webhook callback", job_id=job_id)
            webhook_data = {
                "job_id": job["job_id"],
                "status": "done",
                "md_key": md_key,
                "json_key": json_key
            }
            
            try:
                # Sign the webhook with HMAC
                import hmac
                import hashlib
                webhook_secret = os.environ.get("WEBHOOK_SECRET", "")
                
                if not webhook_secret:
                    log_error("WEBHOOK_SECRET not found in environment", job_id=job_id)
                    raise ValueError("WEBHOOK_SECRET required")
                
                signature = hmac.new(
                    webhook_secret.encode(),
                    json.dumps(webhook_data).encode(),
                    hashlib.sha256
                ).hexdigest()
                
                log_debug("Sending webhook", 
                         job_id=job_id, webhook_url=WEBHOOK, 
                         payload=webhook_data)
                
                response = requests.post(
                    WEBHOOK,
                    headers={
                        "X-Modal-Signature": signature,
                        "Content-Type": "application/json"
                    },
                    json=webhook_data,
                    timeout=30
                )
                
                log_info("Webhook sent", 
                        job_id=job_id, 
                        status_code=response.status_code,
                        response_text=response.text[:500])  # Limit response text
                
                if not response.ok:
                    log_error("Webhook returned error status", 
                             job_id=job_id, 
                             status_code=response.status_code,
                             response_text=response.text)
                
            except Exception as e:
                log_error("Webhook callback failed", error=e, job_id=job_id)
                # Don't raise here - transcription succeeded even if webhook failed
        
        total_time = time.time() - start_time
        log_info("Transcription job completed successfully", 
                job_id=job_id, total_duration_seconds=total_time)
                
    except json.JSONDecodeError as e:
        log_error("Invalid JSON in job payload", error=e, job_json=job_json)
        raise
    except Exception as e:
        job_id = job.get("job_id", "unknown") if job else "unknown"
        log_error("Transcription job failed", error=e, job_id=job_id)
        
        # Send error webhook if we have job info
        if job and WEBHOOK:
            try:
                error_webhook_data = {
                    "job_id": job["job_id"],
                    "status": "error",
                    "error_message": str(e)
                }
                
                import hmac
                import hashlib
                webhook_secret = os.environ.get("WEBHOOK_SECRET", "")
                
                if webhook_secret:
                    signature = hmac.new(
                        webhook_secret.encode(),
                        json.dumps(error_webhook_data).encode(),
                        hashlib.sha256
                    ).hexdigest()
                    
                    requests.post(
                        WEBHOOK,
                        headers={
                            "X-Modal-Signature": signature,
                            "Content-Type": "application/json"
                        },
                        json=error_webhook_data,
                        timeout=30
                    )
                    log_info("Error webhook sent", job_id=job_id)
            except Exception as webhook_error:
                log_error("Failed to send error webhook", 
                         error=webhook_error, job_id=job_id)
        
        raise


@app.function()
@modal.fastapi_endpoint(method="POST")
async def enqueue(request: Request):
    """FastAPI endpoint – receives a JSON payload, spawns the GPU job, returns 202."""
    try:
        body_bytes = await request.body()
        log_info(
            "Enqueue request received",
            method=request.method,
            url=str(request.url),
            content_length=len(body_bytes) if body_bytes else 0,
        )

        # Parse & validate JSON payload
        try:
            job_data = json.loads(body_bytes)
            job_id = job_data.get("job_id", "unknown")
            log_info("Job payload parsed", job_id=job_id, job_data=job_data)
        except json.JSONDecodeError as e:
            log_error(
                "Invalid JSON in enqueue request",
                error=e,
                snippet=body_bytes[:500].decode(errors="replace"),
            )
            return {"error": "Invalid JSON"}, 400

        # Spawn transcription task (non-blocking)
        transcribe_task.spawn(body_bytes.decode())
        log_info("Transcription task spawned", job_id=job_id)

        return {"status": "queued", "job_id": job_id}, 202

    except Exception as e:
        log_error("Enqueue failed", error=e)
        return {"error": "Internal server error"}, 500


# ---------- Entry Point ----------
if __name__ == "__main__":
    # For local testing
    log_info("Starting Modal app in local mode")
    app.serve()