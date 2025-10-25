/*
 * Minimal logue SDK stubs for WASM compilation
 */

#ifndef LOGUE_STUBS_H
#define LOGUE_STUBS_H

#include <stdint.h>
#include <stdlib.h>
#include <math.h>

// Type definitions (minimal subset used by preview)
typedef struct user_osc_param {
    float pitch;      // 0.0-1.0 phase increment in preview builds
    uint16_t shape;   // 0-1023 shape parameter
    uint16_t shiftshape;
} user_osc_param_t;

// Constants
#define k_samplerate 48000.0f
#define k_samplerate_recipf (1.0f/48000.0f)

// Math functions
#define osc_sinf(x) sinf((x) * 6.28318530718f)
#define osc_cosf(x) cosf((x) * 6.28318530718f)
#define osc_softclipf(c, x) (x)  // Simplified - just pass through

static inline float osc_white(void) {
    return ((float)rand() / (float)RAND_MAX) * 2.0f - 1.0f;
}

// Conversion functions
static inline int32_t f32_to_q31(float x) {
    return (int32_t)(x * 2147483647.0f);
}

#define param_val_to_f32(val) ((uint16_t)(val) * 9.77517106549365e-004f)

static inline float osc_notehzf(uint8_t note) {
    const float a = 440.0f;
    const float n = ((int)note) - 69;
    return a * powf(2.0f, n / 12.0f);
}

static inline float osc_w0f_for_note(uint8_t note, uint8_t mod) {
    const float f0 = osc_notehzf(note);
    const float f1 = osc_notehzf(note + 1);
    const float frac = mod / 255.0f;
    const float f = f0 + (f1 - f0) * frac;
    return f * k_samplerate_recipf;
}

// Oscillator API functions (to be implemented in fm_bell.c)
void OSC_INIT(uint32_t platform, uint32_t api);
void OSC_CYCLE(const user_osc_param_t * const params, int32_t *yn, const uint32_t frames);
void OSC_NOTEON(const user_osc_param_t * const params);
void OSC_NOTEOFF(const user_osc_param_t * const params);
void OSC_PARAM(uint16_t index, uint16_t value);

#endif
