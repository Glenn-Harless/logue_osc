#!/bin/bash
# Non-interactive Docker command for CI/automation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_PATH="${PROJECT_ROOT}/logue-sdk/platform"

docker run --rm -v "${PLATFORM_PATH}:/workspace" -h logue-sdk logue-sdk-dev-env:latest /app/cmd_entry "$@"