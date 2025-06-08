#!/bin/bash

echo "Building fm-bell oscillator to WASM..."

# Create a temporary copy with our stubs
cp ../../oscillators/fm-bell/fm_bell.c fm_bell_wasm.c

# Replace the include
sed -i '' 's/#include "userosc.h"/#include "logue-stubs.h"/' fm_bell_wasm.c

# Compile to WASM
emcc fm_bell_wasm.c \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="FMBellModule" \
  -s EXPORTED_FUNCTIONS='["_OSC_INIT","_OSC_CYCLE","_OSC_NOTEON","_OSC_NOTEOFF","_OSC_PARAM","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=65536 \
  -o fm-bell.js

# Clean up
rm fm_bell_wasm.c

echo "Build complete! Output: fm-bell.js and fm-bell.wasm"