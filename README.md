# Logue OSC - Custom Oscillators for Korg Minilogue XD

This repository contains custom oscillator development for the Korg Minilogue XD synthesizer, including a web-based preview tool for testing oscillators before deploying to hardware.

## Project Structure

```
logue_osc/
├── logue-sdk/          # Korg Logue SDK submodule
├── oscillators/        # Oscillator source code
│   └── fm-bell/       # FM Bell oscillator
├── builds/            # Compiled .mnlgxdunit files
├── web-osc-preview/   # Web-based oscillator preview tool
├── test_harness/      # C test programs
├── tasks/             # Development plans and documentation
└── scripts/           # Build and utility scripts
```

## Quick Start

### 1. Test Oscillators in Browser

```bash
./scripts/dev_preview.py          # rebuilds WASM + launches http.server on port 8080
# or skip the rebuild if you already ran the wasm build script
./scripts/dev_preview.py --skip-build
# Open http://localhost:8080
```

- Mix three oscillators (two analog models + one logue SDK user slot)
- Click "Load Selected" in Oscillator 3 to compile + load the logue SDK oscillator via WASM
- Use each oscillator card to tweak waveform, shape, level, and logue parameters in real time

### 2. Build Oscillators for Hardware

```bash
cd oscillators/fm-bell
make
# Output: fm_bell.mnlgxdunit
```

### 3. Load to Minilogue XD

1. Use Korg Librarian software
2. Load the .mnlgxdunit file from `builds/`
3. Access in USER oscillator slots

## Current Oscillators

### FM Bell
- Two-operator FM synthesis
- Creates bell, kalimba, and steel drum sounds
- Parameter map follows `OSC_PARAM` slots (ratio, FM depth, decay, fine, vibrato)
- Latest build: `builds/fm_bell_v5.mnlgxdunit`

## Web Preview Tool

The web-based preview tool (`web-osc-preview/`) allows you to:
- Test oscillator code before hardware deployment
- Adjust logue parameters in real-time (auto-generated from manifest)
- Visualize waveforms
- Layer three oscillators (two built-in, one logue SDK) to approximate Minilogue XD signal flow
- Switch between built-in waveforms and custom oscillators compiled from the logue SDK

### Features
- Web Audio API at 48kHz (matching hardware)
- AudioWorklet-based mixer for stable multi-oscillator playback
- Dynamic parameter panel sourced from logue manifests (`web-osc-preview/manifests/`)
- Waveform visualization
- Loads logue SDK C oscillators through Emscripten WASM (with JS fallback for development)

## Development

### Prerequisites
- Korg Logue SDK
- ARM GCC toolchain (for hardware builds)
- Emscripten (optional, for WASM builds)
- Python 3 (for web server)

### Building from Source

1. **Hardware build**:
   ```bash
   cd oscillators/[oscillator-name]
   make
   ```

2. **Web build** (requires Emscripten):
   ```bash
   cd web-osc-preview/wasm
   ./build-fm-bell.sh
   ```

### Oscillator Metadata

- `web-osc-preview/manifests/index.json` lists available custom oscillators for the preview UI.
- `web-osc-preview/manifests/<oscillator>.json` describes each user oscillator's `OSC_PARAM` slots and build artefacts.
- Manifests drive the web UI so new oscillators only need C code + metadata to appear in the preview.

### Development Utilities

- `scripts/dev_preview.py` – optional helper that rebuilds the active logue SDK oscillator to WASM (using Emscripten) and launches the preview server.

## Documentation

- `tasks/app_plan.md` - Web preview tool implementation plan
- `tasks/mxd_imp.md` - Hardware integration guide
- `oscillators/fm-bell/IMPLEMENTATION_PLAN.md` - FM Bell design details

## License

This project uses the Korg Logue SDK. See the SDK license for details.
