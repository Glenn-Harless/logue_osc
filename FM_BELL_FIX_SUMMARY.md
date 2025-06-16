# FM Bell v5 - Fix Summary

## What Was Fixed

### 1. Initialization Values (fm_bell.c:50-64)
**Before:**
```c
state.ratio = 1.0f;
state.fm_depth = 0.0f;
state.amp_decay = 0.99f;
state.mod_decay = 0.99f;
```

**After:**
```c
state.ratio = 3.5f;        // Default to nice bell ratio
state.fm_depth = 2.5f;     // Audible FM depth
state.amp_decay = 0.9995f; // Much longer decay for bell sound
state.mod_decay = 0.999f;  // Slightly faster mod decay
```

### 2. Shape Knob Support (fm_bell.c:146-167)
Added handling for the shape knob parameter:
```c
case k_user_osc_param_shape:
    // Shape knob controls multiple parameters for expressiveness
    // 0-1 mapped to various bell characteristics
    
    // Ratio: 1-8 (bell-like ratios)
    state.ratio = 1.0f + valf * 7.0f;
    
    // FM Depth: increases with shape
    state.fm_depth = 1.0f + valf * 4.0f;
    
    // Decay: shorter as shape increases
    {
        float decay_time = 5.0f - valf * 4.5f; // 5s to 0.5s
        state.amp_decay = fast_expf(-1.0f / (decay_time * k_samplerate));
        state.mod_decay = fast_expf(-1.0f / (decay_time * 0.3f * k_samplerate));
    }
    break;

case k_user_osc_param_shiftshape:
    // Shift+Shape controls vibrato amount
    state.vibrato_depth = valf * 50.0f; // 0-50% vibrato
    break;
```

### 3. Shape LFO Support (fm_bell.c:73-84)
Added LFO modulation for the shape parameter:
```c
// Apply shape LFO if present
float shape_lfo = q31_to_f32(params->shape_lfo);
float effective_ratio = state.ratio;
float effective_fm_depth = state.fm_depth;

// LFO can modulate ratio and FM depth slightly
if (shape_lfo != 0.0f) {
    effective_ratio += shape_lfo * 0.5f;
    effective_fm_depth += shape_lfo * 0.5f;
}
```

## Building the Fixed Version

### Option 1: Docker Build (Recommended)
```bash
# 1. Ensure Docker image is built
cd /Users/glennharless/dev/logue_osc/logue-sdk/docker
./build_image.sh

# 2. Build the oscillator
cd /Users/glennharless/dev/logue_osc
./scripts/build.sh minilogue-xd/fm-bell
```

### Option 2: Manual Build (Requires ARM toolchain)
```bash
# Install toolchain first
cd /Users/glennharless/dev/logue_osc/logue-sdk/tools/gcc
./get_gcc_5_4-2016q3_macos.sh

# Then build
cd /Users/glennharless/dev/logue_osc/oscillators/fm-bell
make clean
make
```

### Option 3: Use Pre-built Binary
If you have a working fm_bell.mnlgxdunit from before, you can:
1. Rename it to fm_bell_v5.mnlgxdunit
2. Load it to test (though it won't have the fixes)

## Testing the Fixes

1. Load fm_bell_v5.mnlgxdunit onto your Minilogue XD
2. Select the FM Bell oscillator
3. You should immediately hear sound (no need to adjust decay first)
4. Turn the SHAPE knob to hear different bell tones
5. Hold SHIFT and turn SHAPE to add vibrato

## Files Modified

- `/Users/glennharless/dev/logue_osc/oscillators/fm-bell/fm_bell.c` - Updated with fixes
- `/Users/glennharless/dev/logue_osc/logue-sdk/platform/minilogue-xd/fm-bell/fm_bell.c` - Also updated

The source code is ready, but needs to be compiled using either the Docker environment or ARM toolchain.