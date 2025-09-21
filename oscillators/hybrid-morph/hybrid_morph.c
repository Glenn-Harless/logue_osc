#include "userosc.h"
#include <math.h>

#define PARAM_MORPH   0
#define PARAM_DETUNE  1
#define PARAM_TEXTURE 2
#define PARAM_MOTION  3
#define PARAM_ATTACK  4
#define PARAM_RELEASE 5

#define LFO_MIN_HZ 0.05f
#define LFO_MAX_HZ 4.0f

#define ATTACK_MIN_S 0.0005f
#define ATTACK_MAX_S 2.0f
#define RELEASE_MIN_S 0.002f
#define RELEASE_MAX_S 4.0f

typedef struct {
  float phase_a;
  float phase_b;
  float morph;
  float morph_target;
  float detune_ratio;
  float texture_amount;

  float lfo_phase;
  float lfo_rate;
  float lfo_depth;

  float env;
  float env_target;
  float env_attack_coeff;
  float env_release_coeff;

  uint32_t noise_state;
  uint8_t note_on;
} hybrid_state_t;

static hybrid_state_t s_state;

static inline float wrap_phase(float phase) {
  phase -= floorf(phase);
  return phase;
}

static inline float fast_tanh(float x) {
  const float x2 = x * x;
  return x * (27. + x2) / (27. + 9. * x2);
}

static inline float wave_a(float phase) {
  float fundamental = osc_sinf(phase);
  float third = osc_sinf(wrap_phase(phase * 3.f));
  float fifth = osc_sinf(wrap_phase(phase * 5.f));
  return (fundamental + 0.35f * third + 0.2f * fifth) * 0.7f;
}

static inline float wave_b(float phase, float *last) {
  float saw = (phase * 2.f) - 1.f;
  float filtered = saw * 0.4f + (*last) * 0.6f;
  *last = filtered;
  float hp = filtered - 0.2f * osc_sinf(wrap_phase(phase * 2.f));
  return hp;
}

static inline float next_noise(hybrid_state_t *st) {
  st->noise_state = st->noise_state * 1664525u + 1013904223u;
  return (float)((int32_t)(st->noise_state >> 9) - 0x00008000) * (1.0f / 32768.f);
}

static inline float coef_from_time(float time_sec) {
  return expf(-1.f / (time_sec * k_samplerate));
}

void OSC_INIT(uint32_t platform, uint32_t api) {
  (void)platform;
  (void)api;
  hybrid_state_t *st = &s_state;
  st->phase_a = 0.f;
  st->phase_b = 0.f;
  st->morph = 0.5f;
  st->morph_target = 0.5f;
  st->detune_ratio = 0.f;
  st->texture_amount = 0.f;
  st->lfo_phase = 0.f;
  st->lfo_rate = 0.3f;
  st->lfo_depth = 0.0f;
  st->env = 0.f;
  st->env_target = 0.f;
  st->env_attack_coeff = coef_from_time(0.01f);
  st->env_release_coeff = coef_from_time(0.4f);
  st->noise_state = 0x12345678u;
  st->note_on = 0u;
}

void OSC_CYCLE(const user_osc_param_t * const params, int32_t *yn, const uint32_t frames) {
  hybrid_state_t *st = &s_state;

  const float w0 = params->pitch;
  const float detuned_inc = w0 * (1.f + st->detune_ratio);
  const float base_inc = w0;
  const float lfo_inc = st->lfo_rate * k_samplerate_recipf;

  float last_b = 0.f;

  for (uint32_t i = 0; i < frames; i++) {
    st->phase_a = wrap_phase(st->phase_a + base_inc);
    st->phase_b = wrap_phase(st->phase_b + detuned_inc);

    float morph = st->morph + 0.005f * (st->morph_target - st->morph);
    st->morph = morph;

    st->lfo_phase = wrap_phase(st->lfo_phase + lfo_inc);
    const float lfo = osc_sinf(st->lfo_phase) * st->lfo_depth;
    const float blend = fminf(fmaxf(morph + lfo, 0.f), 1.f);

    const float a = wave_a(st->phase_a);
    const float b = wave_b(st->phase_b, &last_b);
    float sample = a + (b - a) * blend;

    const float noise = next_noise(st);
    sample += noise * st->texture_amount * 0.35f;

    if (st->note_on) {
      st->env_target = 1.f;
      st->env += (1.f - st->env) * (1.f - st->env_attack_coeff);
    } else {
      st->env_target = 0.f;
      st->env *= st->env_release_coeff;
    }

    sample *= st->env;
    sample = osc_softclipf(0.7f, sample);
    sample = fast_tanh(sample);

    yn[i] = f32_to_q31(sample);
  }
}

void OSC_NOTEON(const user_osc_param_t * const params) {
  (void)params;
  hybrid_state_t *st = &s_state;
  st->note_on = 1u;
  st->env = 0.f;
  st->phase_a = 0.f;
  st->phase_b = 0.33f;
}

void OSC_NOTEOFF(const user_osc_param_t * const params) {
  (void)params;
  s_state.note_on = 0u;
}

void OSC_PARAM(uint16_t index, uint16_t value) {
  hybrid_state_t *st = &s_state;
  const float valf = param_val_to_f32(value);

  switch (index) {
    case PARAM_MORPH:
      st->morph_target = valf;
      break;
    case PARAM_DETUNE: {
      const float cents = (valf - 0.5f) * 30.f;
      st->detune_ratio = powf(2.f, cents / 1200.f) - 1.f;
      break;
    }
    case PARAM_TEXTURE:
      st->texture_amount = valf;
      break;
    case PARAM_MOTION: {
      st->lfo_rate = LFO_MIN_HZ + (LFO_MAX_HZ - LFO_MIN_HZ) * valf;
      st->lfo_depth = 0.45f * valf;
      break;
    }
    case PARAM_ATTACK: {
      const float t = ATTACK_MIN_S * powf(ATTACK_MAX_S / ATTACK_MIN_S, valf);
      st->env_attack_coeff = coef_from_time(t);
      break;
    }
    case PARAM_RELEASE: {
      const float t = RELEASE_MIN_S * powf(RELEASE_MAX_S / RELEASE_MIN_S, valf);
      st->env_release_coeff = coef_from_time(t);
      break;
    }
    default:
      break;
  }
}
