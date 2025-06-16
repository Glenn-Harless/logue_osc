/*
 * FM Bell Oscillator for Korg minilogue XD
 * 
 * Two-operator FM synthesis with envelope control
 * Creates bell-like tones suitable for steel drums, kalimba, etc.
 */

#include "userosc.h"

// Parameter indices
#define PARAM_RATIO      0  // Modulator:Carrier ratio
#define PARAM_FM_DEPTH   1  // FM modulation depth
#define PARAM_DECAY      2  // Amplitude envelope decay
#define PARAM_MOD_DECAY  3  // Modulator envelope decay
#define PARAM_FINE_RATIO 4  // Fine ratio adjustment
#define PARAM_VIBRATO    5  // Vibrato depth

// Constants
#define VIBRATO_FREQ    5.0f  // Hz
#define MIN_DECAY_TIME  0.001f
#define MAX_DECAY_TIME  10.0f

// FM oscillator state
typedef struct {
    float carrier_phase;
    float mod_phase;
    float ratio;
    float fine_ratio;
    float fm_depth;
    float amp_env;
    float mod_env;
    float amp_decay;
    float mod_decay;
    float vibrato_phase;
    float vibrato_depth;
    uint8_t note_on;
} FMBellState;

static FMBellState state;

// Fast exponential approximation for envelopes
static inline float fast_expf(float x) {
    x = 1.0f + x / 256.0f;
    x *= x; x *= x; x *= x; x *= x;
    x *= x; x *= x; x *= x; x *= x;
    return x;
}

// Initialize oscillator
void OSC_INIT(uint32_t platform, uint32_t api)
{
    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.ratio = 3.5f;        // Default to nice bell ratio
    state.fine_ratio = 0.0f;
    state.fm_depth = 2.5f;     // Audible FM depth
    state.amp_env = 0.0f;
    state.mod_env = 0.0f;
    state.amp_decay = 0.9995f; // Much longer decay for bell sound
    state.mod_decay = 0.999f;  // Slightly faster mod decay
    state.vibrato_phase = 0.0f;
    state.vibrato_depth = 0.0f;
    state.note_on = 0;
}

// Main synthesis function
void OSC_CYCLE(const user_osc_param_t * const params,
               int32_t *yn,
               const uint32_t frames)
{
    const float w0 = params->pitch;
    
    // Apply shape LFO if present
    float shape_lfo = q31_to_f32(params->shape_lfo);
    float effective_ratio = state.ratio;
    float effective_fm_depth = state.fm_depth;
    
    // LFO can modulate ratio and FM depth slightly
    if (shape_lfo != 0.0f) {
        effective_ratio += shape_lfo * 0.5f;
        effective_fm_depth += shape_lfo * 0.5f;
    }
    
    const float mod_w0 = w0 * (effective_ratio + state.fine_ratio);
    
    // Vibrato LFO increment
    const float vibrato_inc = VIBRATO_FREQ * k_samplerate_recipf;
    
    // Process audio frames
    for (uint32_t i = 0; i < frames; i++) {
        // Update envelopes
        state.amp_env *= state.amp_decay;
        state.mod_env *= state.mod_decay;
        
        // Calculate vibrato
        float vibrato = 0.0f;
        if (state.vibrato_depth > 0.0f) {
            vibrato = osc_sinf(state.vibrato_phase) * state.vibrato_depth * 0.01f;
            state.vibrato_phase += vibrato_inc;
            state.vibrato_phase -= (uint32_t)state.vibrato_phase;
        }
        
        // FM synthesis
        // Modulator
        float mod_sig = osc_sinf(state.mod_phase);
        mod_sig *= effective_fm_depth * state.mod_env;
        
        // Carrier with FM and vibrato
        float carrier_freq = w0 * (1.0f + vibrato);
        float carrier_phase_mod = state.carrier_phase + mod_sig;
        float output = osc_sinf(carrier_phase_mod);
        output *= state.amp_env;
        
        // Update phases
        state.carrier_phase += carrier_freq;
        state.carrier_phase -= (uint32_t)state.carrier_phase;
        
        state.mod_phase += mod_w0;
        state.mod_phase -= (uint32_t)state.mod_phase;
        
        // Convert to output format with soft clipping
        output = osc_softclipf(0.05f, output);
        yn[i] = f32_to_q31(output);
    }
}

// Note on event
void OSC_NOTEON(const user_osc_param_t * const params)
{
    state.note_on = 1;
    
    // Reset envelopes with velocity sensitivity
    float velocity = params->pitch >> 8; // Extract velocity
    velocity = (velocity + 64.0f) / 127.0f; // Scale 0-127 to 0.5-1.0
    
    state.amp_env = velocity;
    state.mod_env = 1.0f;
    
    // Reset phases for clean attack
    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.vibrato_phase = 0.0f;
}

// Note off event
void OSC_NOTEOFF(const user_osc_param_t * const params)
{
    state.note_on = 0;
    // Envelopes continue to decay naturally
}

// Parameter change
void OSC_PARAM(uint16_t index, uint16_t value)
{
    const float valf = param_val_to_f32(value);
    
    switch (index) {
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
            
        case PARAM_RATIO:
            // Scale 0-1 to 1-20
            state.ratio = 1.0f + valf * 19.0f;
            break;
            
        case PARAM_FM_DEPTH:
            // Scale 0-1 to 0-10 for modulation index
            state.fm_depth = valf * 10.0f;
            break;
            
        case PARAM_DECAY:
            // Convert to decay factor (longer = closer to 1.0)
            {
                float decay_time = MIN_DECAY_TIME + valf * (MAX_DECAY_TIME - MIN_DECAY_TIME);
                state.amp_decay = fast_expf(-1.0f / (decay_time * k_samplerate));
            }
            break;
            
        case PARAM_MOD_DECAY:
            // Modulator decay, typically faster than carrier
            {
                float decay_time = MIN_DECAY_TIME + valf * (MAX_DECAY_TIME - MIN_DECAY_TIME) * 0.5f;
                state.mod_decay = fast_expf(-1.0f / (decay_time * k_samplerate));
            }
            break;
            
        case PARAM_FINE_RATIO:
            // Fine ratio adjustment -0.5 to +0.5
            state.fine_ratio = (valf - 0.5f);
            break;
            
        case PARAM_VIBRATO:
            // Vibrato depth 0-100%
            state.vibrato_depth = valf * 100.0f;
            break;
            
        default:
            break;
    }
}