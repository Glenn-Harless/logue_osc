#!/usr/bin/env python3
"""Create scaffolding for a new logue oscillator.

This helper automates the busywork of wiring a freshly generated oscillator
into the toolchain:

* writes a manifest stub in web-osc-preview/manifests/
* appends an entry to manifests/index.json
* creates a WASM build script under web-osc-preview/wasm/
* optionally registers basic metadata such as tags and parameters

Example usage:

    ./scripts/add_oscillator.py \
        --id fm-piano \
        --name "FM Piano" \
        --description "Bright FM piano from AI generator" \
        --tags fm piano \
        --param "0|Ratio|FM ratio 1-20|0|1023|512|FM" \
        --param "1|Depth|Mod depth|0|1023|512|FM"
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = REPO_ROOT / "web-osc-preview" / "manifests"
WASM_DIR = REPO_ROOT / "web-osc-preview" / "wasm"
OSC_DIR = REPO_ROOT / "oscillators"
INDEX_PATH = MANIFEST_DIR / "index.json"
VALIDATE_SCRIPT = REPO_ROOT / "scripts" / "validate_manifests.py"

ID_PATTERN = re.compile(r"^[a-z0-9-]+$")


@dataclass
class Parameter:
    index: int
    name: str
    description: str
    min: int
    max: int
    default: int | None = None
    group: str | None = None

    def to_manifest(self) -> dict:
        data = {
            "index": self.index,
            "name": self.name,
            "description": self.description,
            "min": self.min,
            "max": self.max,
        }
        if self.default is not None:
            data["default"] = self.default
        if self.group:
            data["group"] = self.group
        return data


def parse_param(value: str) -> Parameter:
    parts = value.split("|")
    if len(parts) < 5:
        raise ValueError("Parameter specification must have at least 5 fields: index|name|description|min|max[|default[|group]]")

    try:
        index = int(parts[0])
    except ValueError as exc:  # pragma: no cover
        raise ValueError("Parameter index must be an integer") from exc

    name = parts[1].strip()
    description = parts[2].strip()
    if not name:
        raise ValueError("Parameter name cannot be empty")
    if not description:
        raise ValueError("Parameter description cannot be empty")

    try:
        min_value = int(parts[3])
        max_value = int(parts[4])
    except ValueError as exc:  # pragma: no cover
        raise ValueError("Parameter min/max must be integers") from exc

    default = None
    if len(parts) >= 6 and parts[5].strip():
        try:
            default = int(parts[5])
        except ValueError as exc:  # pragma: no cover
            raise ValueError("Parameter default must be an integer") from exc

    group = parts[6].strip() if len(parts) >= 7 and parts[6].strip() else None

    return Parameter(index=index, name=name, description=description, min=min_value, max=max_value, default=default, group=group)


def infer_source_path(osc_id: str) -> Path:
    candidates = [
        OSC_DIR / osc_id / f"{osc_id}.c",
        OSC_DIR / osc_id / f"{osc_id.replace('-', '_')}.c",
        OSC_DIR / osc_id / "osc.c",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Could not locate a source file for '{osc_id}'. Provide --source explicitly.")


def camel_module_name(osc_id: str) -> str:
    parts = [segment.capitalize() for segment in re.split(r"[-_]+", osc_id) if segment]
    return "".join(parts) + "Module"


def create_manifest(args, params: list[Parameter], source_path: Path) -> Path:
    manifest_path = MANIFEST_DIR / f"{args.id}.json"
    if manifest_path.exists() and not args.force:
        raise FileExistsError(f"Manifest {manifest_path} already exists. Use --force to overwrite.")

    manifest = {
        "id": args.id,
        "name": args.name,
        "description": args.description,
        "source": str(source_path.relative_to(REPO_ROOT)),
        "parameters": [param.to_manifest() for param in params],
    }
    if args.tags:
        manifest["tags"] = args.tags
    if args.default_level is not None:
        manifest["defaultLevel"] = args.default_level

    manifest["wasm"] = {
        "module": f"../wasm/{args.id}.js",
    }
    if args.fallback_module:
        fallback = {"module": args.fallback_module}
        if args.fallback_export:
            fallback["export"] = args.fallback_export
        manifest["fallback"] = fallback

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest_path


def update_index(args) -> None:
    data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    oscillators = data.get("oscillators", [])
    if any(entry.get("id") == args.id for entry in oscillators):
        if not args.force:
            raise ValueError(f"Oscillator id '{args.id}' already exists in index.json. Use --force to replace.")
        oscillators = [entry for entry in oscillators if entry.get("id") != args.id]

    oscillators.append({
        "id": args.id,
        "name": args.name,
        "description": args.description,
        "manifest": f"manifests/{args.id}.json"
    })

    oscillators.sort(key=lambda entry: entry.get("name", ""))
    data["oscillators"] = oscillators
    INDEX_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def create_wasm_script(args, source_path: Path) -> Path:
    dest_path = WASM_DIR / f"build-{args.id}.sh"
    if dest_path.exists() and not args.force:
        raise FileExistsError(f"WASM build script {dest_path} already exists. Use --force to overwrite.")

    source_filename = source_path.name
    temp_filename = source_filename.replace('.c', '_wasm.c')
    module_name = camel_module_name(args.id)

    script = f"""#!/bin/bash

set -euo pipefail

echo \"Building {args.id} oscillator to WASM...\"

SRC=../../{source_path.relative_to(REPO_ROOT)}
TMP={temp_filename}
OUT={args.id}.js

cp "$SRC" "$TMP"
sed -i '' 's/#include \"userosc.h\"/#include \"logue-stubs.h\"/' "$TMP"

emcc "$TMP" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=\"{module_name}\" \
  -s EXPORTED_FUNCTIONS='[\"_OSC_INIT\",\"_OSC_CYCLE\",\"_OSC_NOTEON\",\"_OSC_NOTEOFF\",\"_OSC_PARAM\",\"_malloc\",\"_free\"]' \
  -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=65536 \
  -o "$OUT"

rm "$TMP"

echo \"Build complete! Output: {args.id}.js and {args.id}.wasm\"
"""

    dest_path.write_text(script + "\n", encoding="utf-8")
    dest_path.chmod(0o755)
    return dest_path


def run_validator():
    try:
        subprocess.run([sys.executable, str(VALIDATE_SCRIPT)], check=True)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError("Manifest validation failed") from exc


def ensure_parameters(params: list[Parameter]) -> list[Parameter]:
    if params:
        return params
    print("No parameters provided; creating a default Shape parameter (0-1023).", file=sys.stderr)
    return [Parameter(index=0, name="Shape", description="Primary shape parameter", min=0, max=1023, default=512)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a new logue oscillator")
    parser.add_argument("--id", required=True, help="oscillator identifier (lowercase letters, numbers, hyphens)")
    parser.add_argument("--name", required=True, help="display name")
    parser.add_argument("--description", required=True, help="short description")
    parser.add_argument("--source", help="path to oscillator C source (defaults to oscillators/<id>/<id>.c)")
    parser.add_argument("--tags", nargs="*", help="optional list of tags")
    parser.add_argument("--default-level", type=float, help="optional default user oscillator level (0-100)")
    parser.add_argument("--param", action="append", default=[], help="parameter spec: index|name|description|min|max[|default[|group]] (repeatable)")
    parser.add_argument("--fallback-module", help="optional JS fallback module path (relative to web preview)")
    parser.add_argument("--fallback-export", default="", help="optional named export for fallback module")
    parser.add_argument("--force", action="store_true", help="overwrite existing manifest/build script/index entry")

    args = parser.parse_args()

    if not ID_PATTERN.match(args.id):
        raise SystemExit("Oscillator id may only contain lowercase letters, numbers, and hyphens")

    source_path = Path(args.source).resolve() if args.source else infer_source_path(args.id)
    if not source_path.exists():
        raise SystemExit(f"Source file {source_path} does not exist")

    params = [parse_param(value) for value in args.param]
    params = ensure_parameters(params)

    manifest_path = create_manifest(args, params, source_path)
    update_index(args)
    wasm_script = create_wasm_script(args, source_path)
    run_validator()

    print(f"Created manifest: {manifest_path.relative_to(REPO_ROOT)}")
    print(f"Updated index: {INDEX_PATH.relative_to(REPO_ROOT)}")
    print(f"Created WASM build script: {wasm_script.relative_to(REPO_ROOT)}")
    print("Next steps:")
    print(f"  1. Build the oscillator: (cd {wasm_script.parent.relative_to(REPO_ROOT)} && ./{wasm_script.name})")
    print(f"  2. Run ./scripts/dev_preview.py --skip-build and load '{args.name}' in the browser.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
