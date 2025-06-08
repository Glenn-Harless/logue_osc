class OscillatorEngine {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.analyser = null;
        this.isPlaying = false;
        
        // For custom waveform generation
        this.scriptNode = null;
        this.phase = 0;
        
        // WASM oscillator
        this.wasmOscillator = null;
        this.useWasm = false;
        
        // Default parameters
        this.currentNote = 60; // Middle C
        this.currentShape = 512; // Middle position (0-1023)
        this.currentVolume = 0.3;
        this.currentWaveform = 'sine';
        
        // Sample rate matching Minilogue XD
        this.sampleRate = 48000;
    }
    
    init() {
        // Create audio context with specific sample rate
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        // Create analyser for visualization
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024; // 512 samples for visualization
        this.analyser.smoothingTimeConstant = 0;
        
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.currentVolume;
        
        // Connect gain to analyser to destination
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }
    
    noteToFrequency(note) {
        // Convert MIDI note to frequency
        return 440 * Math.pow(2, (note - 69) / 12);
    }
    
    generateWaveform(samples, frequency) {
        const phaseIncrement = frequency / this.sampleRate;
        const shapeNorm = this.currentShape / 1023; // Normalize to 0-1
        
        for (let i = 0; i < samples.length; i++) {
            let sample = 0;
            
            switch (this.currentWaveform) {
                case 'sine':
                    // Shape controls harmonic content
                    sample = Math.sin(2 * Math.PI * this.phase);
                    // Add harmonics based on shape
                    if (shapeNorm > 0) {
                        sample += Math.sin(4 * Math.PI * this.phase) * shapeNorm * 0.3;
                        sample += Math.sin(6 * Math.PI * this.phase) * shapeNorm * 0.1;
                    }
                    sample /= (1 + shapeNorm * 0.4); // Normalize
                    break;
                    
                case 'square':
                    // Shape controls pulse width
                    const pulseWidth = 0.1 + shapeNorm * 0.8; // 10% to 90%
                    sample = this.phase < pulseWidth ? 1 : -1;
                    break;
                    
                case 'sawtooth':
                    // Basic saw with shape affecting brightness
                    sample = 2 * this.phase - 1;
                    // Simple lowpass effect based on shape
                    if (shapeNorm < 0.9) {
                        const cutoff = 1 - shapeNorm;
                        sample = sample * cutoff + this.lastSample * (1 - cutoff);
                        this.lastSample = sample;
                    }
                    break;
                    
                case 'triangle':
                    // Triangle with shape affecting symmetry
                    const skew = 0.5 + (shapeNorm - 0.5) * 0.4; // Skew from 0.3 to 0.7
                    if (this.phase < skew) {
                        sample = (this.phase / skew) * 2 - 1;
                    } else {
                        sample = ((1 - this.phase) / (1 - skew)) * 2 - 1;
                    }
                    break;
            }
            
            samples[i] = sample * 0.8; // Scale to prevent clipping
            
            // Update phase
            this.phase += phaseIncrement;
            if (this.phase >= 1) {
                this.phase -= 1;
            }
        }
    }
    
    play(note) {
        if (!this.audioContext) {
            this.init();
        }
        
        if (this.isPlaying) {
            this.stop();
        }
        
        this.currentNote = note || this.currentNote;
        const frequency = this.noteToFrequency(this.currentNote);
        
        // Reset phase for clean start
        this.phase = 0;
        this.lastSample = 0;
        
        // Create script processor for custom waveform generation
        const bufferSize = 256;
        this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 0, 1);
        
        this.scriptNode.onaudioprocess = (e) => {
            const output = e.outputBuffer.getChannelData(0);
            
            if (this.useWasm && this.wasmOscillator && this.currentWaveform === 'fm-bell') {
                // Use FM Bell oscillator
                this.wasmOscillator.process(output, output.length);
            } else {
                // Use built-in waveforms
                this.generateWaveform(output, frequency);
            }
        };
        
        // Apply gain fade-in to prevent clicks
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(
            this.currentVolume, 
            this.audioContext.currentTime + 0.02
        );
        
        // Connect and start
        this.scriptNode.connect(this.gainNode);
        this.isPlaying = true;
        
        // Trigger WASM note on if using WASM
        if (this.useWasm && this.wasmOscillator && this.currentWaveform === 'fm-bell') {
            this.wasmOscillator.noteOn(this.currentNote);
            // Also set the current shape
            this.wasmOscillator.setShape(this.currentShape);
        }
        
        return frequency;
    }
    
    stop() {
        if (this.scriptNode && this.isPlaying) {
            // Fade out to prevent clicks
            this.gainNode.gain.linearRampToValueAtTime(
                0, 
                this.audioContext.currentTime + 0.02
            );
            
            // Disconnect after fade
            setTimeout(() => {
                if (this.scriptNode) {
                    this.scriptNode.disconnect();
                    this.scriptNode = null;
                }
            }, 30);
            
            // Trigger WASM note off
            if (this.useWasm && this.wasmOscillator) {
                this.wasmOscillator.noteOff();
            }
            
            this.isPlaying = false;
        }
    }
    
    setVolume(value) {
        this.currentVolume = value / 100; // Convert from 0-100 to 0-1
        if (this.gainNode && this.isPlaying) {
            this.gainNode.gain.linearRampToValueAtTime(
                this.currentVolume, 
                this.audioContext.currentTime + 0.01
            );
        }
    }
    
    setShape(value) {
        this.currentShape = value;
        // Update WASM oscillator if using it
        if (this.useWasm && this.wasmOscillator) {
            this.wasmOscillator.setShape(value);
        }
    }
    
    async loadWasmOscillator() {
        try {
            // For now, use JavaScript version
            const { FMBellOscillator } = await import('./fm-bell-js.js');
            this.wasmOscillator = new FMBellOscillator();
            
            this.useWasm = true;
            this.currentWaveform = 'fm-bell';
            console.log('FM Bell oscillator loaded (JS version)');
            return true;
            
            // Original WASM loader code (for when emscripten is installed)
            /*
            const { WasmOscillator } = await import('./wasm-loader.js');
            this.wasmOscillator = new WasmOscillator();
            
            const loaded = await this.wasmOscillator.load();
            if (loaded) {
                this.useWasm = true;
                this.currentWaveform = 'fm-bell';
                console.log('WASM oscillator loaded and ready');
                return true;
            }
            */
        } catch (err) {
            console.error('Failed to load oscillator:', err);
        }
        return false;
    }
    
    setWaveform(type) {
        this.currentWaveform = type;
        // If switching away from fm-bell, disable WASM mode for built-in waveforms
        if (type !== 'fm-bell') {
            this.useWasm = false;
        } else if (this.wasmOscillator) {
            this.useWasm = true;
        }
    }
    
    changeNote(note) {
        if (this.isPlaying) {
            // Smoothly transition to new frequency
            this.currentNote = note;
            // We'll recreate the oscillator for simplicity
            // In a production version, we'd modulate the phase increment
            this.play(note);
        }
    }
    
    getWaveformData() {
        if (!this.analyser) return null;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);
        
        return dataArray;
    }
}

// Create global instance
const audioEngine = new OscillatorEngine();