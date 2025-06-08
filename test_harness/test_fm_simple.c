/*
 * Simplified FM bell test - standalone version
 */

#include <stdio.h>
#include <stdint.h>
#include <math.h>

#define SAMPLE_RATE 48000
#define PI 3.14159265359f

// FM bell state
typedef struct {
    float carrier_phase;
    float mod_phase;
    float ratio;
    float fm_depth;
    float amp_env;
    float mod_env;
    float amp_decay;
    float mod_decay;
} FMState;

// Fast sine approximation
float fast_sin(float x) {
    return sinf(x * 2.0f * PI);
}

// Generate FM bell samples
void generate_fm_bell(FMState *state, float frequency, float *output, int num_samples) {
    float carrier_inc = frequency / SAMPLE_RATE;
    float mod_inc = carrier_inc * state->ratio;
    
    for (int i = 0; i < num_samples; i++) {
        // Update envelopes
        state->amp_env *= state->amp_decay;
        state->mod_env *= state->mod_decay;
        
        // FM synthesis
        float mod_sig = fast_sin(state->mod_phase) * state->fm_depth * state->mod_env;
        float output_sig = fast_sin(state->carrier_phase + mod_sig) * state->amp_env;
        
        // Update phases
        state->carrier_phase += carrier_inc;
        if (state->carrier_phase > 1.0f) state->carrier_phase -= 1.0f;
        
        state->mod_phase += mod_inc;
        if (state->mod_phase > 1.0f) state->mod_phase -= 1.0f;
        
        output[i] = output_sig;
    }
}

int main() {
    // Initialize FM state
    FMState state = {
        .carrier_phase = 0.0f,
        .mod_phase = 0.0f,
        .ratio = 1.0f,      // 1:1 ratio
        .fm_depth = 0.5f,   // Moderate FM depth
        .amp_env = 1.0f,    // Start at full amplitude
        .mod_env = 1.0f,
        .amp_decay = 0.9999f,  // Slow decay
        .mod_decay = 0.999f
    };
    
    // Test different parameter settings
    printf("# FM Bell Test Output\n");
    printf("# Testing with 440Hz, ratio=1.0, fm_depth=0.5\n");
    
    float buffer[100];
    
    // Generate and print first 1000 samples
    for (int block = 0; block < 10; block++) {
        generate_fm_bell(&state, 440.0f, buffer, 100);
        
        // Print every 10th sample
        for (int i = 0; i < 100; i += 10) {
            printf("%d, %f\n", block * 100 + i, buffer[i]);
        }
    }
    
    // Test with different ratio
    printf("\n# Testing with ratio=2.0\n");
    state.ratio = 2.0f;
    state.amp_env = 1.0f;
    state.mod_env = 1.0f;
    
    for (int block = 0; block < 5; block++) {
        generate_fm_bell(&state, 440.0f, buffer, 100);
        for (int i = 0; i < 100; i += 10) {
            printf("%d, %f\n", block * 100 + i, buffer[i]);
        }
    }
    
    return 0;
}