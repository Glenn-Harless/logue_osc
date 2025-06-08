/*
 * Simple test harness for Logue SDK oscillators
 * Outputs raw audio data that can be analyzed
 */

#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <math.h>

// Mock the Logue SDK types and functions
typedef struct user_osc_param {
    int32_t pitch;
    int32_t shape_lfo;
} user_osc_param_t;

#define k_samplerate 48000
#define k_samplerate_recipf (1.0f/48000.0f)

// Mock conversion functions
static inline int32_t f32_to_q31(float x) {
    return (int32_t)(x * 2147483647.0f);
}

static inline float q31_to_f32(int32_t x) {
    return (float)x / 2147483647.0f;
}

static inline float param_val_to_f32(uint16_t x) {
    return (float)x / 1023.0f;
}

// Mock oscillator functions
static inline float osc_sinf(float x) {
    return sinf(x * 2.0f * M_PI);
}

static inline float osc_w0f_for_note(uint8_t note, uint8_t mod) {
    float freq = 440.0f * powf(2.0f, (note - 69.0f) / 12.0f);
    return freq / k_samplerate;
}

static inline float osc_softclipf(float c, float x) {
    x = x * (1.0f + c);
    return x / (1.0f + c * fabsf(x));
}

// Include the actual oscillator code
#include "../logue-sdk/platform/minilogue-xd/fm-bell/fm_bell.c"

// Test main
int main() {
    // Initialize
    _hook_init(0, 0);
    
    // Set up test parameters
    user_osc_param_t params;
    params.pitch = (60 << 8) | 0;  // Middle C (MIDI note 60)
    params.shape_lfo = 0;
    
    // Set some initial parameters
    _hook_param(0, 512);   // Ratio = middle
    _hook_param(1, 300);   // FM Depth = ~30%
    _hook_param(2, 700);   // Decay = ~70%
    _hook_param(3, 500);   // Mod Decay = ~50%
    
    // Trigger note on
    _hook_on(&params);
    
    // Generate 1 second of audio
    const int buffer_size = 64;
    int32_t buffer[buffer_size];
    int total_samples = k_samplerate;
    
    printf("# Test output: sample_number, value (-1.0 to 1.0)\n");
    
    int sample_count = 0;
    while (sample_count < total_samples) {
        // Generate audio
        _hook_cycle(&params, buffer, buffer_size);
        
        // Output every 100th sample to keep output manageable
        for (int i = 0; i < buffer_size && sample_count < total_samples; i++) {
            if (sample_count % 100 == 0) {
                float val = q31_to_f32(buffer[i]);
                printf("%d, %f\n", sample_count, val);
            }
            sample_count++;
        }
    }
    
    return 0;
}