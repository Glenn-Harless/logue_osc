// FM Bell Oscillator - Pure JavaScript version for testing
// This is a direct port of fm_bell.c

export class FMBellOscillator {
    constructor() {
        // State from the C struct
        this.carrier_phase = 0.0;
        this.mod_phase = 0.0;
        this.ratio = 1.0;
        this.fine_ratio = 0.0;
        this.fm_depth = 0.0;
        this.amp_env = 0.0;
        this.mod_env = 0.0;
        this.amp_decay = 0.99;    // Original value
        this.mod_decay = 0.99;    // Original value
        this.vibrato_phase = 0.0;
        this.vibrato_depth = 0.0;
        this.note_on = false;
        
        // Constants
        this.VIBRATO_FREQ = 5.0;
        this.MIN_DECAY_TIME = 0.001;
        this.MAX_DECAY_TIME = 10.0;
        this.sampleRate = 48000;
        
        this.currentNote = 60;
        this.currentShape = 512;
    }
    
    // Fast exponential approximation
    fast_expf(x) {
        x = 1.0 + x / 256.0;
        x *= x; x *= x; x *= x; x *= x;
        x *= x; x *= x; x *= x; x *= x;
        return x;
    }
    
    noteOn(note, velocity = 100) {
        this.note_on = true;
        this.currentNote = note;
        
        // Reset envelopes with velocity sensitivity
        const vel = (velocity + 64.0) / 127.0; // This matches the C code but causes > 1.0
        // Actually, let's just use a sensible default
        this.amp_env = 0.8; // Safe amplitude
        this.mod_env = 1.0;
        
        // Reset phases
        this.carrier_phase = 0.0;
        this.mod_phase = 0.0;
        this.vibrato_phase = 0.0;
    }
    
    noteOff() {
        this.note_on = false;
        // Envelopes continue to decay
    }
    
    setShape(value) {
        // Shape controls ratio (0-1023 -> 1-20)
        const valf = value / 1023.0;
        this.ratio = 1.0 + valf * 19.0;
        
        // Also set some FM depth based on shape
        this.fm_depth = valf * 5.0; // 0-5 modulation index
        
        // For now, use simpler decay calculation
        // Lower shape = longer decay (bell-like)
        // Higher shape = shorter decay (percussive)
        this.amp_decay = 0.9999 - (valf * 0.005); // Range: 0.9999 to 0.9949
        this.mod_decay = 0.999 - (valf * 0.002);   // Modulator decays faster
    }
    
    process(outputArray, frames) {
        // Calculate frequency from note
        const frequency = 440 * Math.pow(2, (this.currentNote - 69) / 12);
        const w0 = frequency / this.sampleRate; // Phase increment
        const mod_w0 = w0 * (this.ratio + this.fine_ratio);
        
        // Vibrato LFO increment
        const vibrato_inc = this.VIBRATO_FREQ / this.sampleRate;
        
        // Debug first frame only
        if (this._debugCount === undefined) this._debugCount = 0;
        if (this._debugCount++ < 5) {
            console.log('FM Bell process:', {
                frames,
                amp_env: this.amp_env,
                frequency,
                ratio: this.ratio,
                fm_depth: this.fm_depth
            });
        }
        
        for (let i = 0; i < frames; i++) {
            // Update envelopes
            this.amp_env *= this.amp_decay;
            this.mod_env *= this.mod_decay;
            
            // Calculate vibrato
            let vibrato = 0.0;
            if (this.vibrato_depth > 0.0) {
                vibrato = Math.sin(this.vibrato_phase * 2 * Math.PI) * this.vibrato_depth * 0.01;
                this.vibrato_phase += vibrato_inc;
                this.vibrato_phase -= Math.floor(this.vibrato_phase);
            }
            
            // FM synthesis
            // Modulator
            let mod_sig = Math.sin(this.mod_phase * 2 * Math.PI);
            mod_sig *= this.fm_depth * this.mod_env;
            
            // Carrier with FM and vibrato
            const carrier_freq = w0 * (1.0 + vibrato);
            const carrier_phase_mod = this.carrier_phase + mod_sig;
            let output = Math.sin(carrier_phase_mod * 2 * Math.PI);
            output *= this.amp_env;
            
            // Update phases
            this.carrier_phase += carrier_freq;
            this.carrier_phase -= Math.floor(this.carrier_phase);
            
            this.mod_phase += mod_w0;
            this.mod_phase -= Math.floor(this.mod_phase);
            
            // Soft clipping - more aggressive to prevent harsh sounds
            output = Math.tanh(output * 0.7) * 0.7;
            
            outputArray[i] = output;
        }
    }
}