/*
 * Kalimba Oscillator for Korg minilogue XD
 *
 * Two-operator FM core with plucked envelopes and body resonator
 * tailored for metallic tine and wooden body interactions.
 */

#include "userosc.h"
#include <math.h>
#include <stdbool.h>

// Parameter indices
#define PARAM_TINE        0
#define PARAM_BRIGHTNESS  1
#define PARAM_DECAY       2
#define PARAM_TONE_DECAY  3
#define PARAM_BODY        4
#define PARAM_NOISE       5

// Envelope ranges
#define MIN_DECAY_TIME    0.05f   // seconds
#define MAX_DECAY_TIME    5.0f
#define MIN_TONE_DECAY    0.02f
#define MAX_TONE_DECAY    2.5f
#define MIN_NOISE_TIME    0.008f
#define MAX_NOISE_TIME    0.18f

#define DEFAULT_DECAY_NORM       0.13f
#define DEFAULT_TONE_DECAY_NORM  0.13f
#define DEFAULT_NOISE_NORM       0.4f
#define BASE_PITCH_SHIFT         2.0f

// Pre-selected tine ratios (approximate kalimba partials)
static const float k_tine_ratios[] = {
    1.50f, 1.70f, 1.90f, 2.15f, 2.40f,
    2.70f, 3.10f, 3.50f, 4.00f, 4.60f, 5.20f
};

typedef struct {
    float carrier_phase;
    float mod_phase;
    float ratio;
    float fm_depth;
    float amp_env;
    float mod_env;
    float noise_env;
    float amp_decay;
    float mod_decay;
    float noise_decay;
    float body_state;
    float body_mix;
    float body_coeff;
    float noise_amount;
    float amp_decay_norm;
    float mod_decay_norm;
    float noise_decay_norm;
    float pitch_shift;
} FMKalimbaState;

static FMKalimbaState state;

static inline float fast_expf(float x) {
    x = 1.0f + x / 256.0f;
    x *= x; x *= x; x *= x; x *= x;
    x *= x; x *= x; x *= x; x *= x;
    return x;
}

static inline float calc_amp_decay_coeff(float norm) {
    const float time = MIN_DECAY_TIME + norm * (MAX_DECAY_TIME - MIN_DECAY_TIME);
    return fast_expf(-1.0f / (time * k_samplerate));
}

static inline float calc_mod_decay_coeff(float norm) {
    const float time = MIN_TONE_DECAY + norm * (MAX_TONE_DECAY - MIN_TONE_DECAY);
    return fast_expf(-1.0f / (time * k_samplerate));
}

static inline float calc_noise_decay_coeff(float norm) {
    const float time = MIN_NOISE_TIME + norm * (MAX_NOISE_TIME - MIN_NOISE_TIME);
    return fast_expf(-1.0f / (time * k_samplerate));
}

static inline float interpolate_tine_ratio(float t) {
    const uint32_t table_size = (uint32_t)(sizeof(k_tine_ratios) / sizeof(k_tine_ratios[0]));
    const float scaled = t * (float)(table_size - 1);
    uint32_t index = (uint32_t)scaled;
    if (index >= table_size - 1) {
        return k_tine_ratios[table_size - 1];
    }

    const float frac = scaled - (float)index;
    const float a = k_tine_ratios[index];
    const float b = k_tine_ratios[index + 1];
    return a + (b - a) * frac;
}

void OSC_INIT(uint32_t platform, uint32_t api)
{
    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.ratio = k_tine_ratios[0];
    state.fm_depth = 2.4f;
    state.amp_env = 0.0f;
    state.mod_env = 0.0f;
    state.noise_env = 0.0f;
    state.amp_decay_norm = DEFAULT_DECAY_NORM;
    state.mod_decay_norm = DEFAULT_TONE_DECAY_NORM;
    state.noise_decay_norm = DEFAULT_NOISE_NORM;
    state.amp_decay = calc_amp_decay_coeff(state.amp_decay_norm);
    state.mod_decay = calc_mod_decay_coeff(state.mod_decay_norm);
    state.noise_decay = calc_noise_decay_coeff(state.noise_decay_norm);
    state.body_state = 0.0f;
    state.body_mix = 0.35f;
    state.body_coeff = 0.08f;
    state.noise_amount = 0.25f;
    state.pitch_shift = BASE_PITCH_SHIFT;
}

static inline float fast_log2f(float x) {
    return logf(x) * 1.44269504089f;
}

static inline float calc_w0(const user_osc_param_t * const params) {
#ifdef __EMSCRIPTEN__
    return params->pitch;
#else
    const uint16_t pitch_word = params->pitch;
    const uint8_t note = (pitch_word >> 8) & 0xFF;
    const uint8_t fine = pitch_word & 0xFF;
    return osc_w0f_for_note(note, fine);
#endif
}

static inline float calc_velocity(const user_osc_param_t * const params) {
#ifdef __EMSCRIPTEN__
    const float freq = fmaxf(params->pitch * k_samplerate, 1e-3f);
    const float note = 69.0f + 12.0f * fast_log2f(freq / 440.0f);
    const float scaled = (note + 64.0f) / 127.0f;
    if (scaled < 0.0f) {
        return 0.5f;
    }
    if (scaled > 1.0f) {
        return 1.0f;
    }
    return scaled;
#else
    const uint8_t note = (params->pitch >> 8) & 0xFF;
    return (note + 64.0f) / 127.0f;
#endif
}

void OSC_CYCLE(const user_osc_param_t * const params,
               int32_t *yn,
               const uint32_t frames)
{
    const float w0 = calc_w0(params) * state.pitch_shift;
    const float mod_w0 = w0 * state.ratio;

    for (uint32_t i = 0; i < frames; i++) {
        state.amp_env *= state.amp_decay;
        state.mod_env *= state.mod_decay;
        state.noise_env *= state.noise_decay;

        const float mod_sig = osc_sinf(state.mod_phase) * (state.fm_depth * state.mod_env);
        const float excitation = osc_sinf(state.carrier_phase + mod_sig);

        state.body_state += state.body_coeff * (excitation - state.body_state);
        const float tone = excitation + state.body_mix * (state.body_state - excitation);

        float output = tone * state.amp_env;
        output += osc_white() * (state.noise_env * 0.35f);

        state.carrier_phase += w0;
        state.carrier_phase -= (uint32_t)state.carrier_phase;

        state.mod_phase += mod_w0;
        state.mod_phase -= (uint32_t)state.mod_phase;

        output = osc_softclipf(0.05f, output);
        yn[i] = f32_to_q31(output);
    }
}

void OSC_NOTEON(const user_osc_param_t * const params)
{
    const float velocity = calc_velocity(params);
    const float amp_scale = 0.55f + 0.45f * velocity;
    const float bright_scale = 1.0f + 0.35f * velocity;

    state.amp_env = amp_scale;
    state.mod_env = bright_scale;
    state.noise_env = state.noise_amount * (0.4f + 0.6f * velocity);

    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.body_state = 0.0f;
}

void OSC_NOTEOFF(const user_osc_param_t * const params)
{
    (void)params;
}

void OSC_PARAM(uint16_t index, uint16_t value)
{
    const float valf = param_val_to_f32(value);

    switch (index) {
        case PARAM_TINE:
            state.ratio = interpolate_tine_ratio(valf);
            break;

        case PARAM_BRIGHTNESS:
        {
            const float shaped = valf * valf;
            state.fm_depth = 0.6f + shaped * 12.4f;
            break;
        }

        case PARAM_DECAY:
        {
            state.amp_decay_norm = valf;
            state.amp_decay = calc_amp_decay_coeff(state.amp_decay_norm);
            break;
        }

        case PARAM_TONE_DECAY:
        {
            state.mod_decay_norm = valf;
            state.mod_decay = calc_mod_decay_coeff(state.mod_decay_norm);
            break;
        }

        case PARAM_BODY:
            state.body_mix = valf;
            state.body_coeff = 0.02f + valf * 0.18f;
            break;

        case PARAM_NOISE:
            state.noise_amount = valf;
            state.noise_decay_norm = 0.1f + 0.9f * valf;
            state.noise_decay = calc_noise_decay_coeff(state.noise_decay_norm);
            break;

        case k_user_osc_param_shape:
            state.ratio = interpolate_tine_ratio(valf);
            break;

        case k_user_osc_param_shiftshape:
            state.mod_decay_norm = valf;
            state.mod_decay = calc_mod_decay_coeff(state.mod_decay_norm);
            break;

        default:
            break;
    }
}
