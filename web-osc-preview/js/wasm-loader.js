export class WasmOscillator {
    constructor() {
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
    }
    
    async load() {
        try {
            // Load the WASM module
            const FMBellModule = await import('../wasm/fm-bell.js');
            this.module = await FMBellModule.default();
            
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
        this.module.HEAPU16[(this.paramsPtr + 4) >> 1] = this.currentShape;
        this.module.HEAPU16[(this.paramsPtr + 6) >> 1] = 0; // shiftshape
        
        // Trigger note on
        this.oscNoteOn(this.paramsPtr);
    }
    
    noteOff() {
        if (!this.initialized) return;
        this.oscNoteOff(this.paramsPtr);
    }
    
    setShape(value) {
        if (!this.initialized) return;
        
        this.currentShape = value;
        
        // Update shape parameter (maps to PARAM_RATIO)
        this.oscParam(0, value);
    }
    
    process(outputArray, frames) {
        if (!this.initialized) return;
        
        // Update pitch for current note
        const frequency = 440 * Math.pow(2, (this.currentNote - 69) / 12);
        const pitch = frequency / 48000;
        
        // Update params struct
        this.module.HEAPF32[this.paramsPtr >> 2] = pitch;
        this.module.HEAPU16[(this.paramsPtr + 4) >> 1] = this.currentShape;
        
        // Process audio
        this.oscCycle(this.paramsPtr, this.outputBufferPtr, frames);
        
        // Convert Q31 output to float
        const outputBuffer = new Int32Array(this.module.HEAP32.buffer, this.outputBufferPtr, frames);
        for (let i = 0; i < frames; i++) {
            outputArray[i] = outputBuffer[i] / 2147483647.0;
        }
    }
    
    cleanup() {
        if (this.module) {
            if (this.outputBufferPtr) this.module._free(this.outputBufferPtr);
            if (this.paramsPtr) this.module._free(this.paramsPtr);
        }
    }
}