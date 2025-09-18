#!/usr/bin/env python3
"""Validate logue oscillator manifests against simple structural rules."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = REPO_ROOT / "web-osc-preview" / "manifests"
INDEX_PATH = MANIFEST_DIR / "index.json"
PREVIEW_ROOT = REPO_ROOT / "web-osc-preview"


class ValidationError(Exception):
    pass


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_manifest(manifest_path: Path) -> list[str]:
    errors: list[str] = []
    try:
        manifest = load_json(manifest_path)
    except Exception as exc:  # pylint: disable=broad-except
        errors.append(f"{manifest_path}: failed to parse JSON ({exc})")
        return errors

    required_root = ["id", "name", "description", "source", "parameters"]
    for field in required_root:
        if field not in manifest:
            errors.append(f"{manifest_path}: missing required field '{field}'")

    manifest_id = manifest.get("id")
    if manifest_id and not isinstance(manifest_id, str):
        errors.append(f"{manifest_path}: 'id' must be a string")

    if "defaultLevel" in manifest:
        level = manifest["defaultLevel"]
        if not isinstance(level, (int, float)) or not (0 <= level <= 100):
            errors.append(f"{manifest_path}: defaultLevel must be 0-100 percentage")

    params = manifest.get("parameters", [])
    if not isinstance(params, list) or not params:
        errors.append(f"{manifest_path}: parameters must be a non-empty list")
        return errors

    seen_indices: set[int] = set()
    for idx, param in enumerate(params):
        location = f"{manifest_path} parameters[{idx}]"
        if not isinstance(param, dict):
            errors.append(f"{location}: parameter must be an object")
            continue

        for field in ["index", "name", "description", "min", "max"]:
            if field not in param:
                errors.append(f"{location}: missing field '{field}'")

        index_value = param.get("index")
        if not isinstance(index_value, int):
            errors.append(f"{location}: 'index' must be integer")
        else:
            if not (0 <= index_value <= 255):
                errors.append(f"{location}: 'index' outside 0-255 range")
            if index_value in seen_indices:
                errors.append(f"{location}: duplicate parameter index {index_value}")
            seen_indices.add(index_value)

        for num_field in ["min", "max", "default"]:
            if num_field in param:
                value = param[num_field]
                if not isinstance(value, int):
                    errors.append(f"{location}: '{num_field}' must be integer")
                elif not (0 <= value <= 1023):
                    errors.append(f"{location}: '{num_field}' must be 0-1023")

        min_value = param.get("min")
        max_value = param.get("max")
        if isinstance(min_value, int) and isinstance(max_value, int) and min_value > max_value:
            errors.append(f"{location}: min ({min_value}) greater than max ({max_value})")

        default_value = param.get("default")
        if default_value is not None and isinstance(min_value, int) and isinstance(max_value, int):
            if not (min_value <= default_value <= max_value):
                errors.append(
                    f"{location}: default ({default_value}) outside [{min_value}, {max_value}]"
                )

    return errors


def validate_index() -> tuple[list[str], list[str]]:
    warnings: list[str] = []
    errors: list[str] = []

    if not INDEX_PATH.exists():
        return errors + ["index.json not found"], warnings

    data = load_json(INDEX_PATH)
    entries = data.get("oscillators", [])
    if not isinstance(entries, list):
        errors.append("index.json: 'oscillators' must be a list")
        return errors, warnings

    seen_ids: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("index.json: every oscillator entry must be an object")
            continue

        entry_id = entry.get("id")
        manifest_rel = entry.get("manifest")
        if not entry_id:
            errors.append("index.json: oscillator entry missing 'id'")
            continue

        if entry_id in seen_ids:
            errors.append(f"index.json: duplicate oscillator id '{entry_id}'")
        seen_ids.add(entry_id)

        if not manifest_rel:
            errors.append(f"index.json: oscillator '{entry_id}' missing 'manifest' path")
            continue

        manifest_path = resolve_manifest_path(manifest_rel)
        if not manifest_path.exists():
            errors.append(f"index.json: manifest '{manifest_rel}' not found for oscillator '{entry_id}'")
            continue

        errors.extend(validate_manifest(manifest_path))

    return errors, warnings


def resolve_manifest_path(rel_path: str) -> Path:
    rel = Path(rel_path)
    if rel.is_absolute():
        return rel
    # Allow paths relative to repo root or manifest directory
    candidate = (PREVIEW_ROOT / rel).resolve()
    if candidate.exists():
        return candidate
    return (MANIFEST_DIR / rel).resolve()


def main() -> int:
    errors, warnings = validate_index()

    for warning in warnings:
        print(f"WARNING: {warning}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("All oscillator manifests look good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
