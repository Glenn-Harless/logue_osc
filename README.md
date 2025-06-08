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
cd web-osc-preview
python3 -m http.server 8080
# Open http://localhost:8080
```

- Click "Load FM Bell" to load the oscillator
- Use Play/Stop to test
- Adjust Shape parameter (0-1023) to change the sound

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
- Shape parameter controls FM ratio and decay time
- Latest build: `builds/fm_bell_v4.mnlgxdunit`

## Web Preview Tool

The web-based preview tool (`web-osc-preview/`) allows you to:
- Test oscillator code before hardware deployment
- Adjust parameters in real-time
- Visualize waveforms
- Switch between built-in waveforms and custom oscillators

### Features
- Web Audio API at 48kHz (matching hardware)
- Real-time parameter control
- Waveform visualization
- Support for both JavaScript and WASM oscillators

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

## Documentation

- `tasks/app_plan.md` - Web preview tool implementation plan
- `tasks/mxd_imp.md` - Hardware integration guide
- `oscillators/fm-bell/IMPLEMENTATION_PLAN.md` - FM Bell design details

## License

This project uses the Korg Logue SDK. See the SDK license for details.