#!/bin/bash

set -euo pipefail

echo "Building sync-fold-bass oscillator to WASM..."

SOURCE=../../oscillators/sync-fold-bass/sync_fold_bass.c
TMP=sync_fold_bass_wasm.c
OUT=sync-fold-bass.js

cp "${SOURCE}" "${TMP}"
trap 'rm -f "${TMP}"' EXIT

sed -i '' 's/#include "userosc.h"/#include "logue-stubs.h"/' "${TMP}"

emcc "${TMP}" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="SyncFoldBassModule" \
  -s EXPORT_ES6=0 \
  -s EXPORTED_FUNCTIONS='["_OSC_INIT","_OSC_CYCLE","_OSC_NOTEON","_OSC_NOTEOFF","_OSC_PARAM","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=131072 \
  -o "${OUT}"

echo "Build complete! Output: ${OUT} and ${OUT/.js/.wasm}"
