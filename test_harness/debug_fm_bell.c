/*
 * Debug version of FM bell that prints diagnostic info
 */

#include <stdio.h>
#include <stdint.h>
#include <math.h>

// Mock Logue SDK constants
#define k_samplerate 48000
#define k_samplerate_recipf (1.0f/48000.0f)

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

// Initialize
void init_osc() {
    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.ratio = 1.0f;
    state.fine_ratio = 0.0f;
    state.fm_depth = 0.5f;
    state.amp_env = 1.0f;
    state.mod_env = 1.0f;
    state.amp_decay = 0.9999f;
    state.mod_decay = 0.999f;
    state.vibrato_phase = 0.0f;
    state.vibrato_depth = 0.0f;
    state.note_on = 0;
    
    printf("Initialized: fm_depth=%f, amp_env=%f\n", state.fm_depth, state.amp_env);
}

// Calculate frequency for MIDI note
float note_to_freq(uint8_t note) {
    return 440.0f * powf(2.0f, (note - 69.0f) / 12.0f);
}

// Generate samples
void generate_samples(uint8_t note, int num_samples) {
    float freq = note_to_freq(note);
    float w0 = freq / k_samplerate;
    float mod_w0 = w0 * (state.ratio + state.fine_ratio);
    
    printf("Note %d: freq=%f Hz, w0=%f, mod_w0=%f\n", note, freq, w0, mod_w0);
    printf("First 10 samples:\n");
    
    for (int i = 0; i < num_samples && i < 10; i++) {
        // Update envelopes
        if (state.amp_env > 0.00001f) {
            state.amp_env *= state.amp_decay;
        }
        if (state.mod_env > 0.00001f) {
            state.mod_env *= state.mod_decay;
        }
        
        // FM synthesis
        float mod_sig = sinf(state.mod_phase * 2.0f * M_PI);
        mod_sig *= state.fm_depth * state.mod_env;
        
        float carrier_phase_mod = state.carrier_phase + mod_sig;
        float output = sinf(carrier_phase_mod * 2.0f * M_PI);
        output *= state.amp_env;
        
        printf("  [%d] mod_phase=%.3f, mod_sig=%.3f, carrier_phase=%.3f, output=%.3f\n",
               i, state.mod_phase, mod_sig, state.carrier_phase, output);
        
        // Update phases
        state.carrier_phase += w0;
        state.carrier_phase -= (int)state.carrier_phase;
        
        state.mod_phase += mod_w0;
        state.mod_phase -= (int)state.mod_phase;
    }
}

int main() {
    printf("=== FM Bell Debug Test ===\n\n");
    
    // Initialize
    init_osc();
    
    // Test middle C
    printf("\nTesting MIDI note 60 (Middle C):\n");
    generate_samples(60, 100);
    
    // Reset and test with different ratio
    printf("\n\nTesting with ratio=2.0:\n");
    state.ratio = 2.0f;
    state.carrier_phase = 0.0f;
    state.mod_phase = 0.0f;
    state.amp_env = 1.0f;
    state.mod_env = 1.0f;
    generate_samples(60, 10);
    
    return 0;
}