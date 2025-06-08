#!/bin/bash
# Interactive shell in Logue SDK Docker container

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/logue-sdk/docker" && ./run_interactive.sh