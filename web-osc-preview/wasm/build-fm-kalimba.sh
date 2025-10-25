#!/bin/bash

set -euo pipefail

echo "Building fm-kalimba oscillator to WASM..."

SOURCE=../../oscillators/fm-kalimba/fm_kalimba.c
TMP=fm_kalimba_wasm.c
OUT=fm-kalimba.js

cp "${SOURCE}" "${TMP}"
trap 'rm -f "${TMP}"' EXIT

sed -i '' 's/#include "userosc.h"/#include "logue-stubs.h"/' "${TMP}"

emcc "${TMP}" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="FMKalimbaModule" \
  -s EXPORT_ES6=0 \
  -s EXPORTED_FUNCTIONS='["_OSC_INIT","_OSC_CYCLE","_OSC_NOTEON","_OSC_NOTEOFF","_OSC_PARAM","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=131072 \
  -o "${OUT}"

echo "Build complete! Output: ${OUT} and ${OUT/.js/.wasm}"
