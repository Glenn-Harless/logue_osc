#!/usr/bin/env python3
"""Utility to rebuild the active logue SDK oscillator to WASM and launch the preview server."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run(command: list[str], cwd: Path) -> None:
    print(f"→ {' '.join(command)}")
    subprocess.run(command, cwd=str(cwd), check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build WASM oscillator and launch the preview server")
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip rebuilding the WASM module before starting the server",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to use for the preview server (default: 8080)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    wasm_dir = repo_root / "web-osc-preview" / "wasm"
    preview_dir = repo_root / "web-osc-preview"

    if not args.skip_build:
        build_script = wasm_dir / "build-fm-bell.sh"
        if not build_script.exists():
            print("Build script not found at", build_script, file=sys.stderr)
            return 1
        run(["bash", str(build_script)], cwd=wasm_dir)
    else:
        print("Skipping WASM build as requested")

    print(f"Starting preview server on http://localhost:{args.port}")
    try:
        run(["python3", "-m", "http.server", str(args.port)], cwd=preview_dir)
    except subprocess.CalledProcessError as err:
        return err.returncode
    except KeyboardInterrupt:
        print("\nServer stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
