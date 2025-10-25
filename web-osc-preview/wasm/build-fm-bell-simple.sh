#!/bin/bash

set -euo pipefail

echo "Building fm-bell oscillator to WASM (simple version)..."

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Emscripten not found. Please install it first:"
    echo ""
    echo "brew install emscripten"
    echo ""
    echo "Or follow instructions at: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create a temporary copy with our stubs
SRC=../../oscillators/fm-bell/fm_bell.c
TMP=fm_bell_wasm.c

cp "$SRC" "$TMP"
trap 'rm -f "$TMP"' EXIT

# Replace the include
sed -i '' 's/#include "userosc.h"/#include "logue-stubs.h"/' "$TMP"

# Compile to WASM with simpler options
emcc "$TMP" \
  -O2 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="FMBellModule" \
  -s EXPORT_ES6=0 \
  -s EXPORTED_FUNCTIONS='["_OSC_INIT","_OSC_CYCLE","_OSC_NOTEON","_OSC_NOTEOFF","_OSC_PARAM","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=131072 \
  -o fm-bell.js

echo "Build complete! Output: fm-bell.js and fm-bell.wasm"
