import { WasmOscillator } from '../wasm-loader.js';
import { FMBellOscillator } from '../fm-bell-js.js';

const VOICE_IDS = ['osc1', 'osc2'];

function createBuiltinVoice(waveform, level) {
    return {
        type: 'builtin',
        waveform,
        shape: 512,
        level,
        phase: 0,
        lastSample: 0
    };
}

class OscMixerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = sampleRate;
        this.isPlaying = false;
        this.currentNote = 60;
        this.currentFrequency = this.noteToFrequency(60);

        this.voices = {
            osc1: createBuiltinVoice('sawtooth', 0.4),
            osc2: createBuiltinVoice('triangle', 0.35),
            osc3: {
                type: 'user',
                level: 0.4
            }
        };

        this.tempBuffer = new Float32Array(128);

        this.userOscillator = null;
        this.userParams = new Map();
        this.userLoaded = false;
        this.userIsFallback = false;

        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    handleMessage(data) {
        if (!data || !data.type) {
            return;
        }

        switch (data.type) {
            case 'setWaveform':
                this.setWaveform(data.id, data.waveform);
                break;
            case 'setShape':
                this.setShape(data.id, data.value);
                break;
            case 'setLevel':
                this.setLevel(data.id, data.value);
                break;
            case 'setUserLevel':
                this.voices.osc3.level = data.value;
                break;
            case 'setNote':
                this.setNote(data.note, data.frequency);
                break;
            case 'play':
                this.play(data.note, data.frequency);
                break;
            case 'stop':
                this.stop();
                break;
            case 'changeNote':
                this.changeNote(data.note, data.frequency);
                break;
            case 'setUserParam':
                this.setUserParam(data.index, data.value);
                break;
            case 'loadUser':
                this.loadUserAsync(data.requestId, data.manifest);
                break;
            default:
                break;
        }
    }

    setWaveform(id, waveform) {
        const voice = this.voices[id];
        if (voice && voice.type === 'builtin') {
            voice.waveform = waveform;
        }
    }

    setShape(id, value) {
        const voice = this.voices[id];
        if (voice && voice.type === 'builtin') {
            voice.shape = value;
        }
    }

    setLevel(id, value) {
        const voice = this.voices[id];
        if (voice) {
            voice.level = value;
        }
    }

    setNote(note, frequency) {
        this.currentNote = note;
        this.currentFrequency = frequency || this.noteToFrequency(note);
        this.resetPhases();
    }

    play(note, frequency) {
        this.setNote(note, frequency);
        this.isPlaying = true;
        if (this.userLoaded && this.userOscillator && typeof this.userOscillator.noteOn === 'function') {
            this.userOscillator.noteOn(note);
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.userLoaded && this.userOscillator && typeof this.userOscillator.noteOff === 'function') {
            this.userOscillator.noteOff();
        }
    }

    changeNote(note, frequency) {
        this.setNote(note, frequency);
        if (this.isPlaying && this.userLoaded && this.userOscillator && typeof this.userOscillator.noteOn === 'function') {
            this.userOscillator.noteOn(note);
        }
    }

    setUserParam(index, value) {
        this.userParams.set(index, value);
        if (!this.userLoaded || !this.userOscillator) {
            return;
        }

        if (typeof this.userOscillator.setParam === 'function') {
            this.userOscillator.setParam(index, value);
        } else if (index === 0 && typeof this.userOscillator.setShape === 'function') {
            this.userOscillator.setShape(value);
        }
    }

    async loadUserAsync(requestId, manifest) {
        this.userOscillator = null;
        this.userLoaded = false;
        this.userIsFallback = false;

        const respond = (status, error) => {
            this.port.postMessage({ type: 'userLoaded', requestId, status, error });
        };

        try {
            if (manifest?.wasm?.module) {
                const osc = new WasmOscillator(manifest.wasm.module);
                const loaded = await osc.load();
                if (loaded) {
                    this.userOscillator = osc;
                    this.userLoaded = true;
                    this.userIsFallback = false;
                    this.applyUserParams();
                    if (this.isPlaying && typeof osc.noteOn === 'function') {
                        osc.noteOn(this.currentNote);
                    }
                    respond('wasm');
                    return;
                }
            }
        } catch (err) {
            this.port.postMessage({ type: 'log', level: 'warn', message: `WASM load failed: ${err?.message || err}` });
        }

        const FallbackClass = this.getFallbackClass(manifest?.id);
        if (FallbackClass) {
            const fallbackOsc = new FallbackClass();
            this.userOscillator = fallbackOsc;
            this.userLoaded = true;
            this.userIsFallback = true;
            this.applyUserParams();
            if (this.isPlaying && typeof fallbackOsc.noteOn === 'function') {
                fallbackOsc.noteOn(this.currentNote);
            }
            respond('fallback');
            return;
        }

        this.port.postMessage({ type: 'log', level: 'error', message: 'No fallback oscillator registered for this manifest' });
        respond('error', 'No fallback oscillator registered');
    }

    getFallbackClass(manifestId) {
        switch (manifestId) {
            case 'fm-bell':
                return FMBellOscillator;
            default:
                return null;
        }
    }

    applyUserParams() {
        if (!this.userLoaded || !this.userOscillator) {
            return;
        }
        for (const [index, value] of this.userParams.entries()) {
            if (typeof this.userOscillator.setParam === 'function') {
                this.userOscillator.setParam(index, value);
            } else if (index === 0 && typeof this.userOscillator.setShape === 'function') {
                this.userOscillator.setShape(value);
            }
        }
    }

    resetPhases() {
        VOICE_IDS.forEach((id) => {
            const voice = this.voices[id];
            if (voice) {
                voice.phase = 0;
                voice.lastSample = 0;
            }
        });
    }

    noteToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    ensureTempBuffer(length) {
        if (!this.tempBuffer || this.tempBuffer.length !== length) {
            this.tempBuffer = new Float32Array(length);
        }
        return this.tempBuffer;
    }

    process(inputs, outputs /* parameters */) {
        const output = outputs[0][0];
        if (!output) {
            return true;
        }

        output.fill(0);

        if (!this.isPlaying || this.currentFrequency <= 0) {
            return true;
        }

        const frames = output.length;

        VOICE_IDS.forEach((id) => {
            const voice = this.voices[id];
            if (!voice || voice.level <= 0) {
                return;
            }
            this.renderBuiltinVoice(voice, output, frames);
        });

        const userVoice = this.voices.osc3;
        if (userVoice.level > 0 && this.userLoaded && this.userOscillator && typeof this.userOscillator.process === 'function') {
            const temp = this.ensureTempBuffer(frames);
            temp.fill(0);
            this.userOscillator.process(temp, frames);
            const level = userVoice.level;
            for (let i = 0; i < frames; i++) {
                output[i] += temp[i] * level;
            }
        }

        for (let i = 0; i < frames; i++) {
            output[i] = Math.tanh(output[i]);
        }
        return true;
    }

    renderBuiltinVoice(voice, output, frames) {
        const phaseIncrement = this.currentFrequency / this.sampleRate;
        const shapeNorm = voice.shape / 1023;
        const level = voice.level;

        for (let i = 0; i < frames; i++) {
            let sample = 0;

            switch (voice.waveform) {
                case 'sine':
                    sample = Math.sin(2 * Math.PI * voice.phase);
                    if (shapeNorm > 0) {
                        sample += Math.sin(4 * Math.PI * voice.phase) * shapeNorm * 0.3;
                        sample += Math.sin(6 * Math.PI * voice.phase) * shapeNorm * 0.1;
                        sample /= (1 + shapeNorm * 0.4);
                    }
                    break;
                case 'square':
                    {
                        const pulseWidth = 0.1 + shapeNorm * 0.8;
                        sample = voice.phase < pulseWidth ? 1 : -1;
                    }
                    break;
                case 'sawtooth':
                    sample = 2 * voice.phase - 1;
                    if (shapeNorm < 0.9) {
                        const cutoff = 1 - shapeNorm;
                        sample = sample * cutoff + voice.lastSample * (1 - cutoff);
                        voice.lastSample = sample;
                    } else {
                        voice.lastSample = sample;
                    }
                    break;
                case 'triangle':
                    {
                        const skew = 0.5 + (shapeNorm - 0.5) * 0.4;
                        if (voice.phase < skew) {
                            sample = (voice.phase / skew) * 2 - 1;
                        } else {
                            sample = ((1 - voice.phase) / (1 - skew)) * 2 - 1;
                        }
                    }
                    break;
                case 'noise':
                    sample = (Math.random() * 2 - 1) * (0.5 + shapeNorm * 0.5);
                    break;
                default:
                    sample = Math.sin(2 * Math.PI * voice.phase);
                    break;
            }

            output[i] += sample * level;

            voice.phase += phaseIncrement;
            if (voice.phase >= 1) {
                voice.phase -= 1;
            }
        }
    }
}

registerProcessor('osc-mixer-processor', OscMixerProcessor);
