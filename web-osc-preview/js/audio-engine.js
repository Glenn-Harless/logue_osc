class OscillatorEngine {
    constructor() {
        this.sampleRate = 48000;
        this.audioContext = null;
        this.gainNode = null;
        this.analyser = null;
        this.scriptNode = null;
        this.bufferSize = 256;
        this.isPlaying = false;
        this.masterVolume = 0.3;
        this.currentNote = 60;

        this.voices = {
            osc1: this.createBuiltinVoice('osc1', 'sawtooth', 0.4),
            osc2: this.createBuiltinVoice('osc2', 'triangle', 0.35),
            osc3: this.createUserVoice('osc3', 0.4)
        };

        this.tempBuffer = new Float32Array(this.bufferSize);
    }

    createBuiltinVoice(id, waveform, level) {
        return {
            id,
            type: 'builtin',
            waveform,
            level,
            shape: 512,
            phase: 0,
            lastSample: 0,
            frequency: 0
        };
    }

    createUserVoice(id, level) {
        return {
            id,
            type: 'user',
            level,
            frequency: 0,
            manifest: null,
            params: new Map(),
            oscillator: null,
            loaded: false,
            isFallback: false
        };
    }

    getVoice(id) {
        return this.voices[id];
    }

    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0;

        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.masterVolume;

        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
    }

    ensureScriptNode() {
        if (this.scriptNode) {
            return;
        }

        this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
        this.scriptNode.onaudioprocess = (event) => {
            const output = event.outputBuffer.getChannelData(0);
            const frames = output.length;
            this.renderVoices(output, frames);
        };
    }

    ensureTempBuffer(frames) {
        if (!this.tempBuffer || this.tempBuffer.length !== frames) {
            this.tempBuffer = new Float32Array(frames);
        }
        return this.tempBuffer;
    }

    noteToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
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

        Object.values(this.voices).forEach((voice) => {
            voice.frequency = frequency;
            voice.phase = 0;
            voice.lastSample = 0;
        });

        this.ensureScriptNode();

        // Fade in master gain to avoid clicks
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(
            this.masterVolume,
            this.audioContext.currentTime + 0.02
        );

        this.scriptNode.connect(this.gainNode);
        this.isPlaying = true;

        const userVoice = this.voices.osc3;
        if (userVoice.loaded && userVoice.oscillator && typeof userVoice.oscillator.noteOn === 'function') {
            userVoice.oscillator.noteOn(this.currentNote);
            this.applyUserParams();
        }

        return frequency;
    }

    changeNote(note) {
        this.currentNote = note;
        const frequency = this.noteToFrequency(note);
        Object.values(this.voices).forEach((voice) => {
            voice.frequency = frequency;
        });

        const userVoice = this.voices.osc3;
        if (this.isPlaying && userVoice.loaded && userVoice.oscillator && typeof userVoice.oscillator.noteOn === 'function') {
            userVoice.oscillator.noteOn(note);
        }
    }

    stop() {
        if (this.scriptNode && this.isPlaying) {
            this.gainNode.gain.linearRampToValueAtTime(
                0,
                this.audioContext.currentTime + 0.02
            );

            setTimeout(() => {
                if (this.scriptNode) {
                    this.scriptNode.disconnect();
                }
            }, 30);

            const userVoice = this.voices.osc3;
            if (userVoice.loaded && userVoice.oscillator && typeof userVoice.oscillator.noteOff === 'function') {
                userVoice.oscillator.noteOff();
            }

            this.isPlaying = false;
        }
    }

    setVolume(value) {
        this.masterVolume = value / 100;
        if (this.gainNode) {
            this.gainNode.gain.linearRampToValueAtTime(
                this.masterVolume,
                this.audioContext.currentTime + 0.01
            );
        }
    }

    setBuiltinWaveform(id, waveform) {
        const voice = this.getVoice(id);
        if (!voice || voice.type !== 'builtin') return;
        voice.waveform = waveform;
        voice.phase = 0;
        voice.lastSample = 0;
    }

    setBuiltinShape(id, value) {
        const voice = this.getVoice(id);
        if (!voice || voice.type !== 'builtin') return;
        voice.shape = value;
    }

    setVoiceLevel(id, value) {
        const voice = this.getVoice(id);
        if (!voice) return;
        voice.level = value / 100;
    }

    async loadUserOscillator(manifest) {
        const voice = this.voices.osc3;
        if (!manifest) {
            return false;
        }

        // Clean up existing oscillator
        if (voice.oscillator && typeof voice.oscillator.cleanup === 'function') {
            voice.oscillator.cleanup();
        }

        voice.manifest = manifest;
        voice.params.clear();
        voice.loaded = false;
        voice.isFallback = false;

        try {
            const { WasmOscillator } = await import('./wasm-loader.js');
            const osc = new WasmOscillator(manifest.wasm?.module || null);
            const loaded = await osc.load();
            if (loaded) {
                voice.oscillator = osc;
                voice.loaded = true;
                this.applyUserParams();
                return true;
            }
        } catch (err) {
            console.warn('WASM oscillator load failed, attempting fallback:', err);
        }

        try {
            if (!manifest.fallback || !manifest.fallback.module) {
                throw new Error('No fallback module specified');
            }
            const module = await import(manifest.fallback.module);
            const OscClass = module[manifest.fallback.export || 'default'];
            if (!OscClass) {
                throw new Error('Fallback oscillator class not found');
            }
            voice.oscillator = new OscClass();
            voice.loaded = true;
            voice.isFallback = true;
            this.applyUserParams();
            console.log('Loaded fallback oscillator implementation');
            return true;
        } catch (fallbackErr) {
            console.error('Failed to load fallback oscillator:', fallbackErr);
        }

        voice.oscillator = null;
        return false;
    }

    setUserParam(index, value) {
        const voice = this.voices.osc3;
        voice.params.set(index, value);

        if (voice.loaded && voice.oscillator) {
            if (typeof voice.oscillator.setParam === 'function') {
                voice.oscillator.setParam(index, value);
            } else if (index === 0 && typeof voice.oscillator.setShape === 'function') {
                voice.oscillator.setShape(value);
            }
        }
    }

    getUserParam(index) {
        const voice = this.voices.osc3;
        return voice.params.has(index) ? voice.params.get(index) : 0;
    }

    hasUserParam(index) {
        return this.voices.osc3.params.has(index);
    }

    applyUserParams() {
        const voice = this.voices.osc3;
        if (!voice.loaded || !voice.oscillator) {
            return;
        }

        for (const [index, value] of voice.params.entries()) {
            if (typeof voice.oscillator.setParam === 'function') {
                voice.oscillator.setParam(index, value);
            } else if (index === 0 && typeof voice.oscillator.setShape === 'function') {
                voice.oscillator.setShape(value);
            }
        }
    }

    renderVoices(output, frames) {
        output.fill(0);

        const voices = Object.values(this.voices);
        for (let i = 0; i < voices.length; i++) {
            const voice = voices[i];
            if (voice.level <= 0 || !voice.frequency) {
                continue;
            }

            if (voice.type === 'builtin') {
                this.renderBuiltinVoice(voice, output, frames);
            } else if (voice.type === 'user') {
                this.renderUserVoice(voice, output, frames);
            }
        }

        // Simple soft clip to avoid runaway levels
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.tanh(output[i]);
        }
    }

    renderBuiltinVoice(voice, output, frames) {
        const phaseIncrement = voice.frequency / this.sampleRate;
        const shapeNorm = voice.shape / 1023;
        const level = voice.level;

        for (let i = 0; i < frames; i++) {
            let sample = 0;

            switch (voice.waveform) {
                case 'sine': {
                    sample = Math.sin(2 * Math.PI * voice.phase);
                    if (shapeNorm > 0) {
                        sample += Math.sin(4 * Math.PI * voice.phase) * shapeNorm * 0.3;
                        sample += Math.sin(6 * Math.PI * voice.phase) * shapeNorm * 0.1;
                        sample /= (1 + shapeNorm * 0.4);
                    }
                    break;
                }
                case 'square': {
                    const pulseWidth = 0.1 + shapeNorm * 0.8;
                    sample = voice.phase < pulseWidth ? 1 : -1;
                    break;
                }
                case 'sawtooth': {
                    sample = 2 * voice.phase - 1;
                    if (shapeNorm < 0.9) {
                        const cutoff = 1 - shapeNorm;
                        sample = sample * cutoff + voice.lastSample * (1 - cutoff);
                        voice.lastSample = sample;
                    } else {
                        voice.lastSample = sample;
                    }
                    break;
                }
                case 'triangle': {
                    const skew = 0.5 + (shapeNorm - 0.5) * 0.4;
                    if (voice.phase < skew) {
                        sample = (voice.phase / skew) * 2 - 1;
                    } else {
                        sample = ((1 - voice.phase) / (1 - skew)) * 2 - 1;
                    }
                    break;
                }
                case 'noise': {
                    sample = (Math.random() * 2 - 1) * (0.5 + shapeNorm * 0.5);
                    break;
                }
                default: {
                    sample = Math.sin(2 * Math.PI * voice.phase);
                    break;
                }
            }

            output[i] += sample * level;

            voice.phase += phaseIncrement;
            if (voice.phase >= 1) {
                voice.phase -= 1;
            }
        }
    }

    renderUserVoice(voice, output, frames) {
        if (!voice.loaded || !voice.oscillator) {
            return;
        }

        const temp = this.ensureTempBuffer(frames);
        temp.fill(0);

        if (typeof voice.oscillator.process === 'function') {
            voice.oscillator.process(temp, frames);
            const level = voice.level;
            for (let i = 0; i < frames; i++) {
                output[i] += temp[i] * level;
            }
        }
    }

    getWaveformData() {
        if (!this.analyser) {
            return null;
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);
        return dataArray;
    }
}

const audioEngine = new OscillatorEngine();
window.audioEngine = audioEngine;
