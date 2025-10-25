class OscillatorEngine {
    constructor() {
        this.sampleRate = 48000;
        this.audioContext = null;
        this.workletNode = null;
        this.gainNode = null;
        this.analyser = null;
        this.masterVolume = 0.3;
        this.currentNote = 60;
        this.isPlaying = false;

        this.workletReadyPromise = null;
        this.pendingRequests = new Map();
        this.requestCounter = 0;

        this.voices = {
            osc1: this.createBuiltinState('sawtooth', 0.4),
            osc2: this.createBuiltinState('triangle', 0.35),
            osc3: this.createUserState(0.4)
        };
    }

    createBuiltinState(waveform, level) {
        return {
            type: 'builtin',
            waveform,
            shape: 512,
            level,
            params: new Map()
        };
    }

    createUserState(level) {
        return {
            type: 'user',
            level,
            manifest: null,
            params: new Map(),
            loaded: false,
            isFallback: false
        };
    }

    getVoice(id) {
        return this.voices[id];
    }

    async ensureWorkletReady() {
        if (this.workletReadyPromise) {
            return this.workletReadyPromise;
        }
        this.workletReadyPromise = this.initializeWorklet();
        return this.workletReadyPromise;
    }

    async initializeWorklet() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });

        const workletUrl = `js/worklets/osc-mixer.js?v=${Date.now()}`;
        await this.audioContext.audioWorklet.addModule(workletUrl);

        this.workletNode = new AudioWorkletNode(this.audioContext, 'osc-mixer-processor');
        this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event.data);

        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.masterVolume;

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0;

        this.workletNode.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.syncStateToWorklet();
    }

    syncStateToWorklet() {
        if (!this.workletNode) {
            return;
        }

        const voice1 = this.voices.osc1;
        const voice2 = this.voices.osc2;
        const voice3 = this.voices.osc3;

        this.workletNode.port.postMessage({ type: 'setNote', note: this.currentNote, frequency: this.noteToFrequency(this.currentNote) });

        this.workletNode.port.postMessage({ type: 'setWaveform', id: 'osc1', waveform: voice1.waveform });
        this.workletNode.port.postMessage({ type: 'setShape', id: 'osc1', value: voice1.shape });
        this.workletNode.port.postMessage({ type: 'setLevel', id: 'osc1', value: voice1.level });

        this.workletNode.port.postMessage({ type: 'setWaveform', id: 'osc2', waveform: voice2.waveform });
        this.workletNode.port.postMessage({ type: 'setShape', id: 'osc2', value: voice2.shape });
        this.workletNode.port.postMessage({ type: 'setLevel', id: 'osc2', value: voice2.level });

        this.workletNode.port.postMessage({ type: 'setUserLevel', value: voice3.level });
    }

    handleWorkletMessage(message) {
        if (!message || !message.type) {
            return;
        }

        switch (message.type) {
            case 'userLoaded': {
                const { requestId, status, error } = message;
                const resolver = this.pendingRequests.get(requestId);
                if (resolver) {
                    this.pendingRequests.delete(requestId);
                    if (status === 'wasm' || status === 'fallback') {
                        const voice = this.voices.osc3;
                        voice.loaded = true;
                        voice.isFallback = status === 'fallback';
                        resolver.resolve({ status });
                    } else {
                        resolver.reject(new Error(error || 'Failed to load user oscillator'));
                    }
                }
                break;
            }
            case 'log':
                // eslint-disable-next-line no-console
                console[message.level === 'error' ? 'error' : 'warn'](message.message);
                break;
            default:
                break;
        }
    }

    nextRequestId() {
        this.requestCounter += 1;
        return this.requestCounter;
    }

    async play(note) {
        const frequency = this.noteToFrequency(note);
        this.currentNote = note;
        await this.ensureWorkletReady();
        await this.audioContext.resume();
        this.workletNode.port.postMessage({ type: 'play', note, frequency });
        this.isPlaying = true;
        return frequency;
    }

    async stop() {
        await this.ensureWorkletReady();
        this.workletNode.port.postMessage({ type: 'stop' });
        this.isPlaying = false;
    }

    async changeNote(note) {
        const frequency = this.noteToFrequency(note);
        this.currentNote = note;
        await this.ensureWorkletReady();
        this.workletNode.port.postMessage({ type: 'changeNote', note, frequency });
    }

    setVolume(value) {
        this.masterVolume = value / 100;
        if (this.gainNode && this.audioContext) {
            this.gainNode.gain.linearRampToValueAtTime(
                this.masterVolume,
                this.audioContext.currentTime + 0.01
            );
        }
    }

    setBuiltinWaveform(id, waveform) {
        const voice = this.voices[id];
        if (!voice || voice.type !== 'builtin') {
            return;
        }
        voice.waveform = waveform;
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'setWaveform', id, waveform });
        }
    }

    setBuiltinShape(id, value) {
        const voice = this.voices[id];
        if (!voice || voice.type !== 'builtin') {
            return;
        }
        voice.shape = value;
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'setShape', id, value });
        }
    }

    setVoiceLevel(id, percentValue) {
        const voice = this.voices[id];
        if (!voice) {
            return;
        }
        const normalized = percentValue / 100;
        voice.level = normalized;

        if (this.workletNode) {
            if (id === 'osc3') {
                this.workletNode.port.postMessage({ type: 'setUserLevel', value: normalized });
            } else {
                this.workletNode.port.postMessage({ type: 'setLevel', id, value: normalized });
            }
        }
    }

    async loadUserOscillator(manifest) {
        const voice = this.voices.osc3;
        voice.manifest = manifest;
        voice.params.clear();
        voice.loaded = false;
        voice.isFallback = false;

        await this.ensureWorkletReady();
        const requestId = this.nextRequestId();

        const resultPromise = new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
        });

        const manifestForWorklet = this.prepareManifestForWorklet(manifest);
        this.workletNode.port.postMessage({ type: 'loadUser', requestId, manifest: manifestForWorklet });

        const result = await resultPromise;
        return result;
    }

    setUserParam(index, value) {
        const voice = this.voices.osc3;
        voice.params.set(index, value);
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'setUserParam', index, value });
        }
    }

    getUserParam(index) {
        const voice = this.voices.osc3;
        return voice.params.has(index) ? voice.params.get(index) : 0;
    }

    hasUserParam(index) {
        return this.voices.osc3.params.has(index);
    }

    noteToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
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

    prepareManifestForWorklet(manifest) {
        const clone = JSON.parse(JSON.stringify(manifest));
        const base = new URL('.', window.location.href);
        const resolve = (path) => {
            if (!path) {
                return path;
            }
            try {
                return new URL(path, base).href;
            } catch (err) {
                return path;
            }
        };

        if (clone.wasm && clone.wasm.module) {
            clone.wasm.module = resolve(clone.wasm.module);
        }
        if (clone.fallback && clone.fallback.module) {
            clone.fallback.module = resolve(clone.fallback.module);
        }
        return clone;
    }
}

const audioEngine = new OscillatorEngine();
window.audioEngine = audioEngine;
