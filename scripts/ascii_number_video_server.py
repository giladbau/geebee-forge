#!/usr/bin/env python3
"""Local companion server for ASCII number video rendering.

This intentionally runs on the user's machine, not in the static Astro site or
Cloudflare Worker. It exposes a small JSON API on localhost, invokes the
existing generator script, and serves the resulting MP4 for preview/download.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import shlex
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
MIN_WIDTH = 320
MAX_WIDTH = 7680
MIN_HEIGHT = 180
MAX_HEIGHT = 4320
MAX_BODY_BYTES = 4096
MAX_LOG_LINES = 400
JOB_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_loopback_host(host: str) -> bool:
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_dimension(name: str, value: Any, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be an integer")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    if parsed % 2 != 0:
        raise ValueError(f"{name} must be an even number")
    return parsed


@dataclass
class RenderJob:
    job_id: str
    width: int
    height: int
    output_path: Path
    command: list[str]
    status: str = "queued"
    phase: str = "queued"
    progress: int = 0
    logs: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=utc_now)
    started_at: str | None = None
    finished_at: str | None = None
    exit_code: int | None = None
    error: str | None = None

    @property
    def output_name(self) -> str:
        return self.output_path.name


class JobStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, RenderJob] = {}
        self._active_job_id: str | None = None
        self._latest_job_id: str | None = None

    def start_job(self, job: RenderJob, generator_cwd: Path) -> tuple[bool, RenderJob | None]:
        with self._lock:
            if self._active_job_id:
                return False, self._jobs[self._active_job_id]
            self._jobs[job.job_id] = job
            self._active_job_id = job.job_id
            self._latest_job_id = job.job_id

        thread = threading.Thread(
            target=self._run_job,
            args=(job.job_id, generator_cwd),
            name=f"ascii-video-{job.job_id[:8]}",
            daemon=True,
        )
        thread.start()
        return True, job

    def latest(self) -> RenderJob | None:
        with self._lock:
            if not self._latest_job_id:
                return None
            return self._jobs.get(self._latest_job_id)

    def get(self, job_id: str) -> RenderJob | None:
        if not JOB_ID_PATTERN.fullmatch(job_id):
            return None
        with self._lock:
            return self._jobs.get(job_id)

    def append_log(self, job_id: str, message: str) -> None:
        clean_message = message.rstrip()
        if not clean_message:
            return
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.logs.append(clean_message)
            if len(job.logs) > MAX_LOG_LINES:
                del job.logs[: len(job.logs) - MAX_LOG_LINES]
            self._update_progress_from_log(job, clean_message)

    def _set_job_started(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "running"
            job.phase = "starting"
            job.progress = 3
            job.started_at = utc_now()

    def _finish_job(self, job_id: str, exit_code: int, error: str | None = None) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.exit_code = exit_code
            job.finished_at = utc_now()
            if exit_code == 0 and job.output_path.is_file():
                job.status = "complete"
                job.phase = "complete"
                job.progress = 100
            else:
                job.status = "failed"
                job.phase = "failed"
                job.progress = max(job.progress, 1)
                job.error = error or f"generator exited with code {exit_code}"
            if self._active_job_id == job_id:
                self._active_job_id = None

    def _update_progress_from_log(self, job: RenderJob, message: str) -> None:
        lower = message.lower()
        if lower.startswith("working directory:"):
            job.phase = "preparing workspace"
            job.progress = max(job.progress, 8)
        elif lower.startswith("rendering "):
            job.phase = "rendering frames"
            job.progress = max(job.progress, 22)
        elif lower.startswith("rendered frame "):
            progress_match = re.search(r"(\d+)/(\d+)", lower)
            if progress_match:
                current = int(progress_match.group(1))
                total = max(1, int(progress_match.group(2)))
                job.phase = "rendering frames"
                job.progress = max(job.progress, 22 + int((current / total) * 20))
        elif lower.startswith("encoding silent video"):
            job.phase = "encoding video"
            job.progress = max(job.progress, 45)
        elif "video render" in lower:
            job.phase = "encoding video"
            job.progress = max(job.progress, 42)
        elif lower.startswith("synthesizing "):
            job.phase = "synthesizing speech"
            job.progress = max(job.progress, 58)
        elif lower.startswith("synthesized audio "):
            progress_match = re.search(r"(\d+)/(\d+)", lower)
            if progress_match:
                current = int(progress_match.group(1))
                total = max(1, int(progress_match.group(2)))
                job.phase = "synthesizing speech"
                job.progress = max(job.progress, 58 + int((current / total) * 28))
        elif lower.startswith("assembling spoken audio"):
            job.phase = "assembling audio"
            job.progress = max(job.progress, 88)
        elif "audio concat" in lower:
            job.phase = "assembling audio"
            job.progress = max(job.progress, 76)
        elif lower.startswith("muxing final mp4"):
            job.phase = "muxing mp4"
            job.progress = max(job.progress, 94)
        elif "final mux" in lower:
            job.phase = "muxing mp4"
            job.progress = max(job.progress, 88)
        elif lower.startswith("done:"):
            job.phase = "complete"
            job.progress = 100

    def _run_job(self, job_id: str, generator_cwd: Path) -> None:
        self._set_job_started(job_id)
        with self._lock:
            job = self._jobs[job_id]
            command = job.command

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        self.append_log(job_id, f"Starting: {shlex.join(command)}")

        try:
            process = subprocess.Popen(
                command,
                cwd=generator_cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except OSError as exc:
            self.append_log(job_id, f"error: could not start generator: {exc}")
            self._finish_job(job_id, 127, str(exc))
            return

        assert process.stdout is not None
        for line in process.stdout:
            self.append_log(job_id, line)

        exit_code = process.wait()
        error = None if exit_code == 0 else f"generator exited with code {exit_code}"
        self._finish_job(job_id, exit_code, error)


def job_to_json(job: RenderJob | None) -> dict[str, Any]:
    if job is None:
        return {"status": "idle", "active": False}

    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "status": job.status,
        "phase": job.phase,
        "progress": job.progress,
        "width": job.width,
        "height": job.height,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "exit_code": job.exit_code,
        "error": job.error,
        "output_name": job.output_name,
        "output_path": str(job.output_path),
        "command": shlex.join(job.command),
        "logs": job.logs[-MAX_LOG_LINES:],
    }
    if job.status == "complete":
        payload["video_url"] = f"/video/{job.job_id}"
        payload["download_url"] = f"/download/{job.job_id}"
    return payload


class AsciiVideoServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], request_handler_class: type[BaseHTTPRequestHandler], *, repo_root: Path, render_root: Path):
        super().__init__(server_address, request_handler_class)
        self.repo_root = repo_root
        self.render_root = render_root
        self.generator_script = repo_root / "scripts" / "generate_ascii_number_video.py"
        self.store = JobStore()


class RequestHandler(BaseHTTPRequestHandler):
    server: AsciiVideoServer

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self._send_json(
                {
                    "name": "ascii-number-video-server",
                    "status": "ok",
                    "endpoints": {
                        "health": "/health",
                        "generate": "POST /generate",
                        "latest_status": "/status",
                        "job_status": "/jobs/<job_id>",
                        "preview": "/video/<job_id>",
                        "download": "/download/<job_id>",
                    },
                }
            )
            return
        if path == "/health":
            self._send_json(
                {
                    "status": "ok",
                    "bind": f"{self.server.server_address[0]}:{self.server.server_address[1]}",
                    "limits": {
                        "width": [MIN_WIDTH, MAX_WIDTH],
                        "height": [MIN_HEIGHT, MAX_HEIGHT],
                        "even_dimensions": True,
                    },
                    "generator": str(self.server.generator_script),
                }
            )
            return
        if path == "/status":
            self._send_json(job_to_json(self.server.store.latest()))
            return

        job_match = re.fullmatch(r"/jobs/([a-f0-9]{32})", path)
        if job_match:
            job = self.server.store.get(job_match.group(1))
            if not job:
                self._send_error_json(HTTPStatus.NOT_FOUND, "job not found")
                return
            self._send_json(job_to_json(job))
            return

        video_match = re.fullmatch(r"/(video|download)/([a-f0-9]{32})", path)
        if video_match:
            self._serve_video(video_match.group(2), attachment=video_match.group(1) == "download")
            return

        self._send_error_json(HTTPStatus.NOT_FOUND, "not found")

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/generate":
            self._send_error_json(HTTPStatus.NOT_FOUND, "not found")
            return

        try:
            payload = self._read_json_body()
            width = validate_dimension("width", payload.get("width"), MIN_WIDTH, MAX_WIDTH)
            height = validate_dimension("height", payload.get("height"), MIN_HEIGHT, MAX_HEIGHT)
        except ValueError as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        job_id = uuid.uuid4().hex
        job_dir = self.server.render_root / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        output_path = job_dir / f"ascii-numbers-{width}x{height}.mp4"
        command = [
            sys.executable,
            "-u",
            str(self.server.generator_script),
            "--width",
            str(width),
            "--height",
            str(height),
            "--output",
            str(output_path),
            "--force",
        ]
        job = RenderJob(job_id=job_id, width=width, height=height, output_path=output_path, command=command)
        accepted, active_job = self.server.store.start_job(job, self.server.repo_root)
        if not accepted:
            try:
                job_dir.rmdir()
            except OSError:
                pass
            self._send_json(
                {
                    "error": "a render is already running",
                    "active_job": job_to_json(active_job),
                },
                status=HTTPStatus.CONFLICT,
            )
            return

        self._send_json(job_to_json(job), status=HTTPStatus.ACCEPTED)

    def _read_json_body(self) -> dict[str, Any]:
        content_length = self.headers.get("Content-Length")
        if content_length is None:
            raise ValueError("missing request body")
        try:
            body_size = int(content_length)
        except ValueError as exc:
            raise ValueError("invalid Content-Length") from exc
        if body_size < 1:
            raise ValueError("missing request body")
        if body_size > MAX_BODY_BYTES:
            raise ValueError("request body is too large")
        raw_body = self.rfile.read(body_size)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("request body must be JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("request body must be a JSON object")
        return payload

    def _serve_video(self, job_id: str, *, attachment: bool) -> None:
        job = self.server.store.get(job_id)
        if not job:
            self._send_error_json(HTTPStatus.NOT_FOUND, "job not found")
            return
        if job.status != "complete" or not job.output_path.is_file():
            self._send_error_json(HTTPStatus.NOT_FOUND, "video is not ready")
            return

        output_path = job.output_path.resolve()
        try:
            output_path.relative_to(self.server.render_root)
        except ValueError:
            self._send_error_json(HTTPStatus.FORBIDDEN, "invalid output path")
            return

        file_size = output_path.stat().st_size
        range_header = self.headers.get("Range")
        start = 0
        end = file_size - 1
        status = HTTPStatus.OK
        if range_header:
            range_match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            if not range_match:
                self._send_range_error(file_size)
                return
            start_text, end_text = range_match.groups()
            if start_text == "" and end_text == "":
                self._send_range_error(file_size)
                return
            if start_text == "":
                suffix_size = int(end_text)
                if suffix_size <= 0:
                    self._send_range_error(file_size)
                    return
                start = max(0, file_size - suffix_size)
            else:
                start = int(start_text)
            if end_text:
                end = int(end_text)
            if start >= file_size or start > end:
                self._send_range_error(file_size)
                return
            end = min(end, file_size - 1)
            status = HTTPStatus.PARTIAL_CONTENT

        content_length = end - start + 1
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        disposition = "attachment" if attachment else "inline"
        self.send_header("Content-Disposition", f'{disposition}; filename="{job.output_name}"')
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        with output_path.open("rb") as video:
            video.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = video.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except BrokenPipeError:
                    break
                remaining -= len(chunk)

    def _send_range_error(self, file_size: int) -> None:
        self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
        self._send_cors_headers()
        self.send_header("Content-Range", f"bytes */{file_size}")
        self.end_headers()

    def _send_json(self, payload: dict[str, Any], *, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: HTTPStatus, message: str) -> None:
        self._send_json({"error": message}, status=status)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the local companion server used by the ASCII Number Video forge page."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"bind host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int, help=f"bind port (default: {DEFAULT_PORT})")
    parser.add_argument(
        "--render-dir",
        type=Path,
        default=Path(".ascii-number-video-renders"),
        help="directory for generated MP4 files (default: .ascii-number-video-renders)",
    )
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="allow binding to a non-loopback host; use only on trusted networks",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    if args.port < 1 or args.port > 65535:
        print("error: --port must be between 1 and 65535", file=sys.stderr)
        return 2
    if not args.allow_remote and not is_loopback_host(args.host):
        print("error: refusing non-loopback bind without --allow-remote", file=sys.stderr)
        return 2

    repo_root = Path(__file__).resolve().parents[1]
    render_root = args.render_dir.expanduser()
    if not render_root.is_absolute():
        render_root = repo_root / render_root
    render_root = render_root.resolve()
    render_root.mkdir(parents=True, exist_ok=True)

    server = AsciiVideoServer((args.host, args.port), RequestHandler, repo_root=repo_root, render_root=render_root)
    print(f"ASCII Number Video server listening on http://{args.host}:{args.port}")
    print(f"Generated MP4 files will be written under {render_root}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
