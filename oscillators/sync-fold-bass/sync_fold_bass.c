/*
 * Sync Fold Bass Oscillator for Korg minilogue XD
 *
 * Hard-sync core with wavefolding, tilt control, sub mix and
 * transient punch for aggressive bass and lead tones.
 */

#include "userosc.h"
#include <math.h>
#include <stdbool.h>

#define PARAM_SYNC    0
#define PARAM_FOLD    1
#define PARAM_TILT    2
#define PARAM_SUB     3
#define PARAM_DRIVE   4
#define PARAM_PUNCH   5

#define DEFAULT_SYNC_NORM   0.55f
#define DEFAULT_FOLD_NORM   0.6f
#define DEFAULT_TILT_NORM   0.5f
#define DEFAULT_SUB_NORM    0.55f
#define DEFAULT_DRIVE_NORM  0.45f
#define DEFAULT_PUNCH_NORM  0.55f

#define MIN_PUNCH_TIME  0.01f
#define MAX_PUNCH_TIME  0.18f

typedef struct {
  float master_phase;
  float slave_phase;
  float sub_phase;

  float sync_ratio;
  float sync_blend;
  float fold_amount;
  float tilt_mix;
  float sub_mix;
  float drive_boost;

  float punch_amount;
  float punch_env;
  float punch_decay;

  float base_gain;
} sync_fold_state_t;

static sync_fold_state_t s_state;

static inline float wrap01(float x) {
  return x - floorf(x);
}

static inline float fast_expf(float x) {
  x = 1.f + x / 256.f;
  x *= x; x *= x; x *= x; x *= x;
  x *= x; x *= x; x *= x; x *= x;
  return x;
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

static inline float fold_once(float x) {
  if (x > 1.f) {
    x = 2.f - x;
  } else if (x < -1.f) {
    x = -2.f - x;
  }
  return x;
}

static inline float wavefoldf(float x, float amount) {
  const float drive = 1.f + amount * 4.5f;
  float y = x * drive;
  y = fold_once(y);
  y = fold_once(y);
  y = fold_once(y);
  return y;
}

static inline float calc_sync_ratio(float norm) {
  const float shaped = norm * norm;
  return 1.f + shaped * 5.5f;
}

static inline float calc_sync_blend(float norm) {
  return 0.35f + norm * 0.55f;
}

static inline float calc_drive_boost(float norm) {
  return 0.9f + norm * 2.6f;
}

static inline float calc_punch_decay(float norm) {
  const float time = MIN_PUNCH_TIME + norm * (MAX_PUNCH_TIME - MIN_PUNCH_TIME);
  return fast_expf(-1.f / (time * k_samplerate));
}

static inline void set_sync(sync_fold_state_t *st, float norm) {
  st->sync_ratio = calc_sync_ratio(norm);
  st->sync_blend = calc_sync_blend(norm);
}

static inline void set_fold(sync_fold_state_t *st, float norm) {
  st->fold_amount = norm;
}

static inline void set_tilt(sync_fold_state_t *st, float norm) {
  st->tilt_mix = fminf(fmaxf(norm, 0.f), 1.f);
}

static inline void set_sub(sync_fold_state_t *st, float norm) {
  st->sub_mix = fminf(fmaxf(norm, 0.f), 1.f);
}

static inline void set_drive(sync_fold_state_t *st, float norm) {
  st->drive_boost = calc_drive_boost(norm);
}

static inline void set_punch(sync_fold_state_t *st, float norm) {
  st->punch_amount = fminf(fmaxf(norm, 0.f), 1.f);
  st->punch_decay = calc_punch_decay(norm);
}

void OSC_INIT(uint32_t platform, uint32_t api) {
  (void)platform;
  (void)api;

  sync_fold_state_t *st = &s_state;
  st->master_phase = 0.f;
  st->slave_phase = 0.f;
  st->sub_phase = 0.f;

  set_sync(st, DEFAULT_SYNC_NORM);
  set_fold(st, DEFAULT_FOLD_NORM);
  set_tilt(st, DEFAULT_TILT_NORM);
  set_sub(st, DEFAULT_SUB_NORM);
  set_drive(st, DEFAULT_DRIVE_NORM);
  set_punch(st, DEFAULT_PUNCH_NORM);

  st->punch_env = 0.f;
  st->base_gain = 0.55f;
}

void OSC_CYCLE(const user_osc_param_t * const params, int32_t *yn, const uint32_t frames) {
  sync_fold_state_t *st = &s_state;

  const float w0 = calc_w0(params);
  const float slave_inc = w0 * st->sync_ratio;
  const float sub_inc = w0 * 0.5f;

  float master_phase = st->master_phase;
  float slave_phase = st->slave_phase;
  float sub_phase = st->sub_phase;
  float punch_env = st->punch_env;

  for (uint32_t i = 0; i < frames; i++) {
    master_phase += w0;
    bool reset = false;
    if (master_phase >= 1.f) {
      master_phase -= 1.f;
      reset = true;
    }

    slave_phase += slave_inc;
    if (reset) {
      slave_phase = slave_inc;
    }
    slave_phase = wrap01(slave_phase);

    sub_phase += sub_inc;
    sub_phase = wrap01(sub_phase);

    const float saw = (slave_phase * 2.f) - 1.f;

    const float punch = punch_env * st->punch_amount;
    const float dynamic_fold = fminf(st->fold_amount + punch * 0.8f, 1.2f);
    float folded = wavefoldf(saw, dynamic_fold);

    float even_phase = slave_phase * 2.f;
    even_phase = even_phase - floorf(even_phase);
    const float even_wave = (even_phase * 2.f) - 1.f;

    const float tilt_mix = st->tilt_mix;
    float tone = folded * (1.f - tilt_mix) + even_wave * tilt_mix;

    const float sync_mix = st->sync_blend;
    tone = tone * sync_mix + saw * (1.f - sync_mix);

    const float sub = osc_sinf(sub_phase) * 0.8f;
    float combined = tone * (1.f - st->sub_mix) + sub * st->sub_mix;

    const float drive = fminf(st->drive_boost + punch * 1.4f, 4.0f);
    float sample = combined * st->base_gain * drive;
    sample = osc_softclipf(0.22f, sample);

    yn[i] = f32_to_q31(sample);

    punch_env *= st->punch_decay;
  }

  st->master_phase = master_phase;
  st->slave_phase = slave_phase;
  st->sub_phase = sub_phase;
  st->punch_env = punch_env;
}

void OSC_NOTEON(const user_osc_param_t * const params) {
  (void)params;
  sync_fold_state_t *st = &s_state;
  st->master_phase = 0.f;
  st->slave_phase = 0.f;
  st->sub_phase = 0.f;
  st->punch_env = 1.f;
}

void OSC_NOTEOFF(const user_osc_param_t * const params) {
  (void)params;
}

void OSC_PARAM(uint16_t index, uint16_t value) {
  sync_fold_state_t *st = &s_state;
  const float valf = param_val_to_f32(value);

  switch (index) {
    case PARAM_SYNC:
      set_sync(st, valf);
      break;

    case PARAM_FOLD:
      set_fold(st, valf);
      break;

    case PARAM_TILT:
    {
      const float tilt_norm = fminf(fmaxf(valf, 0.f), 1.f);
      set_tilt(st, tilt_norm);
      break;
    }

    case PARAM_SUB:
      set_sub(st, valf);
      break;

    case PARAM_DRIVE:
      set_drive(st, valf);
      break;

    case PARAM_PUNCH:
      set_punch(st, valf);
      break;

    case k_user_osc_param_shape:
      set_sync(st, valf);
      break;

    case k_user_osc_param_shiftshape:
      set_punch(st, valf);
      break;

    default:
      break;
  }
}
