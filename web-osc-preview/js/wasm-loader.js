export class WasmOscillator {
    constructor(modulePath, factoryName) {
        this.module = null;
        this.initialized = false;
        
        // Function pointers
        this.oscInit = null;
        this.oscCycle = null;
        this.oscNoteOn = null;
        this.oscNoteOff = null;
        this.oscParam = null;
        
        // Memory pointers
        this.outputBufferPtr = null;
        this.paramsPtr = null;
        
        // Current state
        this.currentNote = 60;
        this.currentShape = 512;
        this.paramValues = new Map();

        this.modulePath = modulePath;
        this.factoryName = factoryName;
    }
    
    async load() {
        try {
            // Load the WASM module
            if (!this.modulePath) {
                throw new Error('No WASM module path provided');
            }
            if (typeof importScripts === 'function') {
                importScripts(this.modulePath);
            } else {
                throw new Error('importScripts unavailable in this context');
            }

            const factory = (self && this.factoryName) ? self[this.factoryName] : null;
            if (!factory) {
                throw new Error(`Factory ${this.factoryName || '(unknown)'} not found after loading ${this.modulePath}`);
            }

            this.module = await factory();
            
            // Get function pointers
            this.oscInit = this.module.cwrap('OSC_INIT', null, ['number', 'number']);
            this.oscCycle = this.module.cwrap('OSC_CYCLE', null, ['number', 'number', 'number']);
            this.oscNoteOn = this.module.cwrap('OSC_NOTEON', null, ['number']);
            this.oscNoteOff = this.module.cwrap('OSC_NOTEOFF', null, ['number']);
            this.oscParam = this.module.cwrap('OSC_PARAM', null, ['number', 'number']);
            
            // Allocate memory for parameters struct (pitch + shape + shiftshape)
            this.paramsPtr = this.module._malloc(12); // 4 + 2 + 2 bytes
            
            // Allocate memory for output buffer (256 samples * 4 bytes)
            this.outputBufferPtr = this.module._malloc(256 * 4);
            
            // Initialize oscillator
            this.oscInit(0, 0);
            this.initialized = true;
            this.applyStoredParams();

            console.log('FM Bell WASM oscillator loaded successfully');
            return true;
        } catch (err) {
            console.error('Failed to load WASM oscillator:', err);
            return false;
        }
    }
    
    noteOn(note, velocity = 100) {
        if (!this.initialized) return;
        
        this.currentNote = note;
        
        // Update params struct with note frequency
        const frequency = 440 * Math.pow(2, (note - 69) / 12);
        const pitch = frequency / 48000; // phase increment
        
        // Write to params struct
        this.module.HEAPF32[this.paramsPtr >> 2] = pitch;
        const shapeValue = this.paramValues.has(0) ? this.paramValues.get(0) : this.currentShape;
        this.module.HEAPU16[(this.paramsPtr + 4) >> 1] = shapeValue;
        this.module.HEAPU16[(this.paramsPtr + 6) >> 1] = 0; // shiftshape
        
        // Trigger note on
        this.oscNoteOn(this.paramsPtr);
        this.applyStoredParams();
    }
    
    noteOff() {
        if (!this.initialized) return;
        this.oscNoteOff(this.paramsPtr);
    }
    
    setParam(index, value) {
        this.paramValues.set(index, value);

        if (!this.initialized) {
            if (index === 0) {
                this.currentShape = value;
            }
            return;
        }

        this.oscParam(index, value);

        if (index === 0) {
            this.currentShape = value;
            this.module.HEAPU16[(this.paramsPtr + 4) >> 1] = value;
        }
    }

    setShape(value) {
        this.setParam(0, value);
    }
    
    process(outputArray, frames) {
        if (!this.initialized) return;
        
        // Update pitch for current note
        const frequency = 440 * Math.pow(2, (this.currentNote - 69) / 12);
        const pitch = frequency / 48000;
        
        // Update params struct
        this.module.HEAPF32[this.paramsPtr >> 2] = pitch;
        const shapeValue = this.paramValues.has(0) ? this.paramValues.get(0) : this.currentShape;
        this.module.HEAPU16[(this.paramsPtr + 4) >> 1] = shapeValue;
        
        // Process audio
        this.oscCycle(this.paramsPtr, this.outputBufferPtr, frames);
        
        // Convert Q31 output to float
        const outputBuffer = new Int32Array(this.module.HEAP32.buffer, this.outputBufferPtr, frames);
        for (let i = 0; i < frames; i++) {
            outputArray[i] = outputBuffer[i] / 2147483647.0;
        }
    }

    applyStoredParams() {
        if (!this.initialized) {
            return;
        }

        for (const [index, value] of this.paramValues.entries()) {
            this.oscParam(index, value);
        }
    }
    
    cleanup() {
        if (this.module) {
            if (this.outputBufferPtr) this.module._free(this.outputBufferPtr);
            if (this.paramsPtr) this.module._free(this.paramsPtr);
        }
    }
}
