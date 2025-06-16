# Logue SDK Development Environment - Setup and Build Guide

## Overview
This document contains essential information for building minilogue XD oscillators using the Logue SDK with Docker.

## IMPORTANT NOTES FOR CLAUDE CODE
- The Docker image `logue-sdk-dev-env:latest` may already exist - check with `docker images | grep logue-sdk`
- The `scripts/docker-cmd.sh` script provides non-interactive Docker builds
- Always copy oscillator source to `logue-sdk/platform/minilogue-xd/` before building
- Build warnings about unused parameters and TTY are normal and can be ignored

## Quick Start - Building FM Bell

### Prerequisites
- Docker Desktop installed and running
- Git
- ~800MB free disk space for Docker image

### Build Steps

1. **Clone Logue SDK as submodule**
```bash
git submodule add https://github.com/korginc/logue-sdk.git
cd logue-sdk && git submodule update --init --recursive
```

2. **Build Docker Image** (one-time setup, takes ~5-10 minutes)
```bash
cd logue-sdk/docker
./build_image.sh
```

3. **Copy oscillator to SDK platform directory**
```bash
cp -r oscillators/fm-bell logue-sdk/platform/minilogue-xd/
```

4. **Build the oscillator**
```bash
# Create a non-interactive build script
cat > scripts/docker-cmd.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM_PATH="${PROJECT_ROOT}/logue-sdk/platform"

docker run --rm -v "${PLATFORM_PATH}:/workspace" -h logue-sdk logue-sdk-dev-env:latest /app/cmd_entry "$@"
EOF

chmod +x scripts/docker-cmd.sh

# Build
./scripts/docker-cmd.sh build minilogue-xd/fm-bell
```

The output `.mnlgxdunit` file will be in `logue-sdk/platform/minilogue-xd/fm-bell/`

## Key Files for FM Bell Oscillator

### manifest.json
```json
{
    "header" : {
        "platform" : "minilogue-xd",
        "module" : "osc",
        "api" : "1.1-0",
        "dev_id" : 0,
        "prg_id" : 0,
        "version" : "1.0-0",
        "name" : "FM Bell",
        "num_param" : 6,
        "params" : [
            ["Ratio",      1, 20, ""],
            ["FM Depth",   0, 100, "%"],
            ["Decay",      0, 100, "%"],
            ["Mod Decay",  0, 100, "%"],
            ["Fine Ratio", 0, 100, "%"],
            ["Vibrato",    0, 100, "%"]
        ]
    }
}
```

### project.mk
```makefile
PROJECT = fm_bell
UCSRC = fm_bell.c
UCXXSRC =
UINCDIR =
UDEFS =
ULIB = 
ULIBDIR =
```

### Required Hook Functions
The oscillator MUST implement these functions with exact names:
- `_hook_init()` - Initialize oscillator
- `_hook_cycle()` - Generate audio samples
- `_hook_on()` - Note on event
- `_hook_off()` - Note off event
- `_hook_param()` - Parameter changes
- `_hook_mute()` - Mute event
- `_hook_value()` - Value changes (rarely used)

## Common Issues and Solutions

### No Sound Output
1. **Hook functions** - Must use `_hook_*` not `OSC_*` names
2. **Pitch extraction** - Use `osc_w0f_for_note()` properly:
```c
const uint8_t note = (params->pitch) >> 8;
const uint8_t mod = params->pitch & 0xFF;
const float w0 = osc_w0f_for_note(note, mod);
```
3. **Initial envelope values** - Set to non-zero for testing (0.9995 for longer decay)
4. **Output buffer** - Cast to `q31_t*`:
```c
q31_t * __restrict y = (q31_t *)yn;
```
5. **Shape knob not working** - Must handle `k_user_osc_param_shape` in OSC_PARAM:
```c
case k_user_osc_param_shape:
    // Shape value is 0-1023, convert with param_val_to_f32()
    float shape_val = param_val_to_f32(value);
    // Use shape_val to control oscillator parameters
    break;
```

### Docker Build Issues
- **"input device is not a TTY"** - Normal warning, can be ignored
- **"cannot execute binary file"** - Architecture mismatch, Docker handles this
- **Build takes forever** - First build downloads ~800MB, subsequent builds are fast
- **"Unable to find image 'logue-sdk-dev-env:latest'"** - Need to build Docker image first:
```bash
cd logue-sdk/docker && ./build_image.sh
```
- **Docker image already exists** - Check with `docker images | grep logue-sdk`

### Testing Without Hardware
Create a simple test harness to verify synthesis logic:
```c
// See test_harness/test_fm_simple.c for complete example
// Compile with: gcc -o test_fm test_fm_simple.c -lm
// This tests the FM math without needing the SDK
```

## Docker Commands Reference
```bash
# Build Docker image (one-time)
cd logue-sdk/docker && ./build_image.sh

# Interactive shell (requires TTY)
cd logue-sdk/docker && ./run_interactive.sh

# Build command (non-interactive)
docker run --rm -v "$(pwd)/logue-sdk/platform:/workspace" \
    logue-sdk-dev-env:latest /app/cmd_entry build minilogue-xd/fm-bell

# List available commands
docker run --rm logue-sdk-dev-env:latest /app/cmd_entry list
```

## Build Output
Successful build produces:
- `.mnlgxdunit` file - Load this on minilogue XD
- `build/` directory with intermediate files
- Size ~1-2KB for simple oscillators

### Quick Build Process (After Docker Image Exists)
```bash
# From project root
cp -r oscillators/fm-bell logue-sdk/platform/minilogue-xd/
./scripts/docker-cmd.sh build minilogue-xd/fm-bell
cp logue-sdk/platform/minilogue-xd/fm-bell/fm_bell.mnlgxdunit builds/fm_bell_v[VERSION].mnlgxdunit
```

## Oscillator Development Tips
1. Start with high envelope values (0.9999) for testing
2. Use `osc_softclipf()` to prevent harsh clipping
3. Keep phase values between 0-1 using: `phase -= (uint32_t)phase`
4. Parameters arrive as 0-1023, convert with `param_val_to_f32()`
5. Always handle all 6 parameters even if unused
6. **Shape Knob Integration**: The shape knob sends `k_user_osc_param_shape` (value 0-1023)
7. **Shift+Shape**: Sends `k_user_osc_param_shiftshape` for secondary control
8. **Shape LFO**: Access via `params->shape_lfo` in OSC_CYCLE, convert with `q31_to_f32()`

## Directory Structure
```
logue_osc/
├── logue-sdk/              # Official SDK (submodule)
├── oscillators/            # Your custom oscillators
│   └── fm-bell/
├── scripts/
│   └── docker-cmd.sh       # Build helper
├── builds/                 # Output .mnlgxdunit files
└── test_harness/          # Testing tools
```

## Next Steps
- Run the build command whenever you modify the oscillator code
- Test parameters on hardware - they map to the 6 shape knobs
- Create variations by adjusting default values in `_hook_init()`