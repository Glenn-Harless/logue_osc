#!/bin/bash

set -euo pipefail

echo "Building hybrid-morph oscillator to WASM..."

SRC=../../oscillators/hybrid-morph/hybrid_morph.c
TMP=hybrid_morph_wasm.c
OUT=hybrid-morph.js

cp "$SRC" "$TMP"
trap 'rm -f "$TMP"' EXIT
sed -i '' 's/#include "userosc.h"/#include "logue-stubs.h"/' "$TMP"

emcc "$TMP" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="HybridMorphModule" \
  -s EXPORT_ES6=0 \
  -s EXPORTED_FUNCTIONS='["_OSC_INIT","_OSC_CYCLE","_OSC_NOTEON","_OSC_NOTEOFF","_OSC_PARAM","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=196608 \
  -o "$OUT"

echo "Build complete! Output: hybrid-morph.js and hybrid-morph.wasm"
