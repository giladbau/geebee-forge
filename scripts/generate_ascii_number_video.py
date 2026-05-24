#!/usr/bin/env python3
"""Generate a neon ASCII-style MP4 of numbers 1..60 with spoken audio.

The renderer intentionally avoids Python image dependencies. It writes PPM
frames with a tiny built-in bitmap glyph set, then uses edge-tts, ffprobe, and
ffmpeg to synthesize speech, normalize each number to a one-second audio slot,
and mux the final MP4.
"""

from __future__ import annotations

import argparse
import math
import random
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable, Sequence


NUMBERS = range(1, 61)
DIGIT_WIDTH = 13
DIGIT_HEIGHT = 21
DIGIT_GAP = 3
SPOKEN_SLOT_SECONDS = 1.0
SPOKEN_TARGET_SECONDS = 0.92

DIGIT_SEGMENTS = {
    "0": "abcdef",
    "1": "bc",
    "2": "abged",
    "3": "abgcd",
    "4": "fgbc",
    "5": "afgcd",
    "6": "afgecd",
    "7": "abc",
    "8": "abcdefg",
    "9": "abfgcd",
}

GLYPH_ORDER = "@#%&*+=:."
GLYPHS = {
    "@": [
        "01110",
        "10001",
        "10111",
        "10101",
        "10111",
        "10000",
        "01111",
    ],
    "#": [
        "01010",
        "11111",
        "01010",
        "01010",
        "11111",
        "01010",
        "01010",
    ],
    "%": [
        "11001",
        "11010",
        "00100",
        "01000",
        "10110",
        "00110",
        "00000",
    ],
    "&": [
        "01100",
        "10010",
        "10100",
        "01000",
        "10101",
        "10010",
        "01101",
    ],
    "*": [
        "00100",
        "10101",
        "01110",
        "11111",
        "01110",
        "10101",
        "00100",
    ],
    "+": [
        "00000",
        "00100",
        "00100",
        "11111",
        "00100",
        "00100",
        "00000",
    ],
    "=": [
        "00000",
        "00000",
        "11111",
        "00000",
        "11111",
        "00000",
        "00000",
    ],
    ":": [
        "00000",
        "01100",
        "01100",
        "00000",
        "01100",
        "01100",
        "00000",
    ],
    ".": [
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
        "01100",
        "01100",
    ],
}


class GeneratorError(RuntimeError):
    """Raised for expected, user-actionable generator failures."""


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"{value!r} is not an integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def bounded_int(name: str, low: int, high: int):
    def parser(value: str) -> int:
        parsed = positive_int(value)
        if not low <= parsed <= high:
            raise argparse.ArgumentTypeError(f"{name} must be between {low} and {high}")
        return parsed

    return parser


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a one-minute neon ASCII number video. The output shows "
            "numbers 1 through 60, one per second, with edge-tts speech."
        )
    )
    parser.add_argument("--width", "-W", required=True, type=positive_int, help="video width in pixels")
    parser.add_argument("--height", "-H", required=True, type=positive_int, help="video height in pixels")
    parser.add_argument(
        "--output",
        "-o",
        default="ascii-numbers-60s.mp4",
        type=Path,
        help="MP4 output path (default: ascii-numbers-60s.mp4)",
    )
    parser.add_argument(
        "--fps",
        default=30,
        type=bounded_int("fps", 1, 60),
        help="output video frames per second after still-frame expansion (default: 30)",
    )
    parser.add_argument(
        "--voice",
        default="en-US-AriaNeural",
        help="edge-tts voice name (default: en-US-AriaNeural)",
    )
    parser.add_argument(
        "--rate",
        default="+20%",
        help="edge-tts speaking rate, such as +20%% or -10%% (default: +20%%)",
    )
    parser.add_argument(
        "--crf",
        default=18,
        type=bounded_int("crf", 0, 35),
        help="x264 CRF quality value, lower is larger/better (default: 18)",
    )
    parser.add_argument(
        "--preset",
        default="medium",
        choices=["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower"],
        help="x264 preset (default: medium)",
    )
    parser.add_argument(
        "--work-dir",
        type=Path,
        help="directory for intermediate frames/audio; created if missing",
    )
    parser.add_argument(
        "--keep-work",
        action="store_true",
        help="keep intermediate files for inspection",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="overwrite the output file if it already exists",
    )
    return parser.parse_args(argv)


def require_binary(name: str) -> str:
    resolved = shutil.which(name)
    if not resolved:
        raise GeneratorError(
            f"Missing required executable: {name}. Install ffmpeg from https://ffmpeg.org/ "
            "and ensure both ffmpeg and ffprobe are on PATH."
        )
    return resolved


def resolve_edge_tts_command() -> list[str]:
    edge_tts_bin = shutil.which("edge-tts")
    if edge_tts_bin:
        return [edge_tts_bin]

    probe = subprocess.run(
        [sys.executable, "-m", "edge_tts", "--help"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if probe.returncode == 0:
        return [sys.executable, "-m", "edge_tts"]

    raise GeneratorError(
        "Missing required Python package: edge-tts. Install it with "
        "`python3 -m pip install edge-tts`, then re-run this generator."
    )


def validate_args(args: argparse.Namespace) -> None:
    if args.width < 320 or args.height < 180:
        raise GeneratorError("Use at least 320x180 so the ASCII glyphs remain legible.")
    if args.output.suffix.lower() != ".mp4":
        raise GeneratorError("Output path must end with .mp4.")
    if args.output.exists() and not args.force:
        raise GeneratorError(f"{args.output} already exists. Pass --force to overwrite it.")
    if not re.fullmatch(r"[+-]?\d+%", args.rate):
        raise GeneratorError("Rate must look like +20%, 0%, or -10%.")


def run_command(command: Sequence[str], *, label: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        command_text = " ".join(command)
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        detail = stderr or stdout or "no output"
        raise GeneratorError(f"{label} failed ({command_text}):\n{detail}")


def probe_duration(ffprobe: str, media_path: Path) -> float:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(media_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise GeneratorError(f"ffprobe could not read {media_path}: {result.stderr.strip()}")
    try:
        return float(result.stdout.strip())
    except ValueError as exc:
        raise GeneratorError(f"ffprobe returned an invalid duration for {media_path}") from exc


def add_pixel(buffer: bytearray, width: int, height: int, x: int, y: int, color: tuple[int, int, int], alpha: float) -> None:
    if x < 0 or y < 0 or x >= width or y >= height:
        return
    idx = (y * width + x) * 3
    buffer[idx] = min(255, int(buffer[idx] + color[0] * alpha))
    buffer[idx + 1] = min(255, int(buffer[idx + 1] + color[1] * alpha))
    buffer[idx + 2] = min(255, int(buffer[idx + 2] + color[2] * alpha))


def add_rect(
    buffer: bytearray,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(width, x1)
    y1 = min(height, y1)
    if x0 >= x1 or y0 >= y1:
        return
    red = color[0] * alpha
    green = color[1] * alpha
    blue = color[2] * alpha
    for y in range(y0, y1):
        idx = (y * width + x0) * 3
        for _ in range(x0, x1):
            buffer[idx] = min(255, int(buffer[idx] + red))
            buffer[idx + 1] = min(255, int(buffer[idx + 1] + green))
            buffer[idx + 2] = min(255, int(buffer[idx + 2] + blue))
            idx += 3


def make_background(width: int, height: int) -> bytearray:
    rng = random.Random(0xC0FFEE)
    stars = {(rng.randrange(width), rng.randrange(height)): rng.randrange(35, 110) for _ in range(max(24, width * height // 18000))}
    buffer = bytearray(width * height * 3)
    cx = width * 0.5
    cy = height * 0.47
    max_dist = math.hypot(cx, cy)

    for y in range(height):
        v = y / max(1, height - 1)
        scanline = 0.72 if y % 3 == 0 else 1.0
        for x in range(width):
            u = x / max(1, width - 1)
            dist = math.hypot(x - cx, y - cy) / max_dist
            heat = max(0.0, 1.0 - dist)
            red = int((5 + 20 * heat + 10 * u) * scanline)
            green = int((3 + 10 * heat + 8 * (1 - v)) * scanline)
            blue = int((14 + 38 * heat + 18 * v) * scanline)
            star = stars.get((x, y), 0)
            idx = (y * width + x) * 3
            buffer[idx] = min(255, red + star)
            buffer[idx + 1] = min(255, green + star)
            buffer[idx + 2] = min(255, blue + star)
    return buffer


def segment_cells(segment: str) -> Iterable[tuple[int, int]]:
    if segment == "a":
        return ((x, y) for x in range(2, 11) for y in range(0, 3))
    if segment == "b":
        return ((x, y) for x in range(10, 13) for y in range(2, 10))
    if segment == "c":
        return ((x, y) for x in range(10, 13) for y in range(11, 19))
    if segment == "d":
        return ((x, y) for x in range(2, 11) for y in range(18, 21))
    if segment == "e":
        return ((x, y) for x in range(0, 3) for y in range(11, 19))
    if segment == "f":
        return ((x, y) for x in range(0, 3) for y in range(2, 10))
    if segment == "g":
        return ((x, y) for x in range(2, 11) for y in range(9, 12))
    raise ValueError(f"unknown segment {segment}")


def digit_cells(digit: str, offset: int) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    for segment in DIGIT_SEGMENTS[digit]:
        for x, y in segment_cells(segment):
            cells.add((x + offset, y))
    return cells


def number_cells(number: int) -> tuple[set[tuple[int, int]], int]:
    text = str(number)
    cells: set[tuple[int, int]] = set()
    offset = 0
    for digit in text:
        cells.update(digit_cells(digit, offset))
        offset += DIGIT_WIDTH + DIGIT_GAP
    return cells, offset - DIGIT_GAP


def neon_color(cell_x: int, cell_y: int, number: int, total_columns: int) -> tuple[int, int, int]:
    position = cell_x / max(1, total_columns - 1)
    wave = 0.5 + 0.5 * math.sin(number * 0.37 + cell_y * 0.45)
    red = int(120 + 120 * position + 35 * wave)
    green = int(70 + 150 * (1.0 - abs(position - 0.5) * 1.6) + 20 * wave)
    blue = int(170 + 70 * (1.0 - position) + 30 * (1.0 - wave))
    return min(255, red), min(255, green), min(255, blue)


def draw_glyph(
    buffer: bytearray,
    width: int,
    height: int,
    x: int,
    y: int,
    cell_w: int,
    cell_h: int,
    glyph: str,
    color: tuple[int, int, int],
) -> None:
    pattern = GLYPHS[glyph]
    pad_x = max(1, int(cell_w * 0.12))
    pad_y = max(1, int(cell_h * 0.12))
    usable_w = max(1, cell_w - pad_x * 2)
    usable_h = max(1, cell_h - pad_y * 2)
    dot_w = max(1, usable_w // 5)
    dot_h = max(1, usable_h // 7)

    for gy, row in enumerate(pattern):
        for gx, enabled in enumerate(row):
            if enabled != "1":
                continue
            px0 = x + pad_x + gx * usable_w // 5
            py0 = y + pad_y + gy * usable_h // 7
            px1 = min(x + cell_w, px0 + dot_w + 1)
            py1 = min(y + cell_h, py0 + dot_h + 1)
            add_rect(buffer, width, height, px0, py0, px1, py1, color, 0.92)


def render_number_frame(number: int, width: int, height: int, background: bytearray, output_path: Path) -> None:
    cells, total_columns = number_cells(number)
    digit_count = len(str(number))
    target_width_ratio = 0.68 if digit_count == 1 else 0.86
    cell_w = max(4, int(width * target_width_ratio / total_columns))
    cell_h = max(7, int(height * 0.78 / DIGIT_HEIGHT))
    grid_w = total_columns * cell_w
    grid_h = DIGIT_HEIGHT * cell_h
    origin_x = (width - grid_w) // 2
    origin_y = (height - grid_h) // 2
    rng = random.Random(number * 6151)
    buffer = bytearray(background)

    # Low-opacity segment bodies make the ASCII cells read as one large numeral.
    for cell_x, cell_y in cells:
        color = neon_color(cell_x, cell_y, number, total_columns)
        x = origin_x + cell_x * cell_w
        y = origin_y + cell_y * cell_h
        add_rect(
            buffer,
            width,
            height,
            x - cell_w // 2,
            y - cell_h // 2,
            x + cell_w + cell_w // 2,
            y + cell_h + cell_h // 2,
            color,
            0.045,
        )
        add_rect(
            buffer,
            width,
            height,
            x - cell_w // 6,
            y - cell_h // 6,
            x + cell_w + cell_w // 6,
            y + cell_h + cell_h // 6,
            color,
            0.075,
        )

    for cell_x, cell_y in cells:
        color = neon_color(cell_x, cell_y, number, total_columns)
        x = origin_x + cell_x * cell_w
        y = origin_y + cell_y * cell_h
        add_rect(buffer, width, height, x + 1, y + 1, x + cell_w - 1, y + cell_h - 1, color, 0.09)
        glyph = GLYPH_ORDER[(cell_x * 3 + cell_y * 5 + number + rng.randrange(len(GLYPH_ORDER))) % len(GLYPH_ORDER)]
        draw_glyph(buffer, width, height, x, y, cell_w, cell_h, glyph, color)

    # Add a few hot pixels near the numeral for a CRT phosphor feel.
    for _ in range(max(20, width * height // 32000)):
        cell_x, cell_y = rng.choice(tuple(cells))
        color = neon_color(cell_x, cell_y, number, total_columns)
        px = origin_x + cell_x * cell_w + rng.randrange(max(1, cell_w))
        py = origin_y + cell_y * cell_h + rng.randrange(max(1, cell_h))
        add_pixel(buffer, width, height, px, py, color, 0.8)

    with output_path.open("wb") as frame:
        frame.write(f"P6\n{width} {height}\n255\n".encode("ascii"))
        frame.write(buffer)


def render_frames(width: int, height: int, frame_dir: Path) -> None:
    frame_dir.mkdir(parents=True, exist_ok=True)
    print(f"Rendering {len(NUMBERS)} ASCII frames at {width}x{height}...")
    background = make_background(width, height)
    for number in NUMBERS:
        render_number_frame(number, width, height, background, frame_dir / f"frame_{number:03d}.ppm")
        print(f"Rendered frame {number}/{len(NUMBERS)}")


def render_video(ffmpeg: str, frame_dir: Path, video_path: Path, fps: int, crf: int, preset: str) -> None:
    print("Encoding silent video with ffmpeg...")
    filter_chain = (
        f"fps={fps},"
        "noise=alls=3:allf=t+u,"
        "drawgrid=width=iw:height=3:thickness=1:color=black@0.16,"
        "format=yuv420p"
    )
    run_command(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-framerate",
            "1",
            "-start_number",
            "1",
            "-i",
            str(frame_dir / "frame_%03d.ppm"),
            "-vf",
            filter_chain,
            "-c:v",
            "libx264",
            "-preset",
            preset,
            "-crf",
            str(crf),
            "-movflags",
            "+faststart",
            str(video_path),
        ],
        label="video render",
    )


def atempo_chain(speed: float) -> str:
    values: list[float] = []
    remaining = speed
    while remaining > 2.0:
        values.append(2.0)
        remaining /= 2.0
    values.append(remaining)
    return ",".join(f"atempo={value:.5f}" for value in values)


def ffconcat_line(path: Path) -> str:
    escaped = path.as_posix().replace("'", "'\\''")
    return f"file '{escaped}'\n"


def synthesize_audio(
    edge_tts: Sequence[str],
    ffmpeg: str,
    ffprobe: str,
    voice: str,
    rate: str,
    audio_dir: Path,
    combined_audio: Path,
) -> None:
    audio_dir.mkdir(parents=True, exist_ok=True)
    segment_paths: list[Path] = []
    print("Synthesizing spoken numbers with edge-tts...")

    for number in NUMBERS:
        raw_media = audio_dir / f"tts_{number:03d}.mp3"
        segment = audio_dir / f"segment_{number:03d}.wav"
        run_command(
            [
                *edge_tts,
                f"--voice={voice}",
                f"--rate={rate}",
                f"--text={number}",
                f"--write-media={raw_media}",
            ],
            label=f"edge-tts number {number}",
        )
        duration = probe_duration(ffprobe, raw_media)
        filters: list[str] = []
        if duration > SPOKEN_TARGET_SECONDS:
            filters.append(atempo_chain(duration / SPOKEN_TARGET_SECONDS))
        filters.extend(
            [
                f"apad=pad_dur={SPOKEN_SLOT_SECONDS:.3f}",
                f"atrim=0:{SPOKEN_SLOT_SECONDS:.3f}",
                "asetpts=N/SR/TB",
                "aresample=48000",
            ]
        )
        run_command(
            [
                ffmpeg,
                "-y",
                "-hide_banner",
                "-loglevel",
                "warning",
                "-i",
                str(raw_media),
                "-af",
                ",".join(filters),
                "-ac",
                "2",
                "-ar",
                "48000",
                str(segment),
            ],
            label=f"audio slot number {number}",
        )
        segment_paths.append(segment)
        print(f"Synthesized audio {number}/{len(NUMBERS)}")

    concat_file = audio_dir / "concat.txt"
    concat_file.write_text(
        "".join(ffconcat_line(path) for path in segment_paths),
        encoding="utf-8",
    )
    print("Assembling spoken audio...")
    run_command(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(combined_audio),
        ],
        label="audio concat",
    )


def mux_video(ffmpeg: str, video_path: Path, audio_path: Path, output_path: Path) -> None:
    print("Muxing final MP4...")
    run_command(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-i",
            str(video_path),
            "-i",
            str(audio_path),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        label="final mux",
    )


def make_work_dir(args: argparse.Namespace):
    if args.work_dir:
        args.work_dir.mkdir(parents=True, exist_ok=True)
        return args.work_dir.resolve(), None
    if args.keep_work:
        return Path(tempfile.mkdtemp(prefix="ascii-number-video-")).resolve(), None
    temp = tempfile.TemporaryDirectory(prefix="ascii-number-video-")
    return Path(temp.name).resolve(), temp


def generate(args: argparse.Namespace) -> Path:
    validate_args(args)
    ffmpeg = require_binary("ffmpeg")
    ffprobe = require_binary("ffprobe")
    edge_tts = resolve_edge_tts_command()

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    work_dir, cleanup = make_work_dir(args)
    print(f"Working directory: {work_dir}")

    try:
        frame_dir = work_dir / "frames"
        audio_dir = work_dir / "audio"
        silent_video = work_dir / "numbers-video.mp4"
        combined_audio = work_dir / "numbers-audio.m4a"

        render_frames(args.width, args.height, frame_dir)
        render_video(ffmpeg, frame_dir, silent_video, args.fps, args.crf, args.preset)
        synthesize_audio(edge_tts, ffmpeg, ffprobe, args.voice, args.rate, audio_dir, combined_audio)
        mux_video(ffmpeg, silent_video, combined_audio, output)
    finally:
        if cleanup is not None:
            cleanup.cleanup()

    return output


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        output = generate(args)
    except GeneratorError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("error: interrupted", file=sys.stderr)
        return 130

    print(f"Done: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
