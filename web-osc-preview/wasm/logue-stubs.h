/*
 * Minimal logue SDK stubs for WASM compilation
 */

#ifndef LOGUE_STUBS_H
#define LOGUE_STUBS_H

#include <stdint.h>
#include <math.h>

// Type definitions
typedef struct user_osc_param {
    float pitch;      // 0.0 to 1.0 phase increment
    uint16_t shape;   // 0-1023
    uint16_t shiftshape;
} user_osc_param_t;

// Constants
#define k_samplerate 48000.0f
#define k_samplerate_recipf (1.0f/48000.0f)

// Math functions
#define osc_sinf(x) sinf(x * 6.28318530718f)
#define osc_cosf(x) cosf(x * 6.28318530718f)
#define osc_softclipf(c, x) (x)  // Simplified - just pass through

// Conversion functions
static inline int32_t f32_to_q31(float x) {
    return (int32_t)(x * 2147483647.0f);
}

static inline float param_val_to_f32(uint16_t value) {
    return value / 1023.0f;
}

// Oscillator API functions (to be implemented in fm_bell.c)
void OSC_INIT(uint32_t platform, uint32_t api);
void OSC_CYCLE(const user_osc_param_t * const params, int32_t *yn, const uint32_t frames);
void OSC_NOTEON(const user_osc_param_t * const params);
void OSC_NOTEOFF(const user_osc_param_t * const params);
void OSC_PARAM(uint16_t index, uint16_t value);

#endif