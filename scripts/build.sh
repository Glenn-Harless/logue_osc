#!/bin/bash
# Build command wrapper for Logue SDK Docker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/logue-sdk/docker" && ./run_cmd.sh "$@"