// UI Control handlers
document.addEventListener('DOMContentLoaded', () => {
    // Get UI elements
    const playBtn = document.getElementById('play');
    const stopBtn = document.getElementById('stop');
    const noteSelect = document.getElementById('note');
    const waveformSelect = document.getElementById('waveform');
    const loadWasmBtn = document.getElementById('load-wasm');
    const shapeSlider = document.getElementById('shape');
    const shapeValue = document.getElementById('shape-value');
    const volumeSlider = document.getElementById('volume');
    const volumeValue = document.getElementById('volume-value');
    const statusSpan = document.getElementById('status');
    const frequencySpan = document.getElementById('frequency');
    const canvas = document.getElementById('waveform-display');
    const ctx = canvas ? canvas.getContext('2d') : null;
    
    if (!canvas || !ctx) {
        console.error('Canvas element or context not found!');
        return;
    }
    
    // Animation frame ID for waveform
    let animationId = null;
    
    // Play button handler
    playBtn.addEventListener('click', () => {
        const note = parseInt(noteSelect.value);
        const frequency = audioEngine.play(note);
        
        // Update UI
        playBtn.disabled = true;
        stopBtn.disabled = false;
        statusSpan.textContent = 'Playing';
        frequencySpan.textContent = frequency.toFixed(2);
        
        // Start waveform animation
        drawWaveform();
    });
    
    // Stop button handler
    stopBtn.addEventListener('click', () => {
        audioEngine.stop();
        
        // Update UI
        playBtn.disabled = false;
        stopBtn.disabled = true;
        statusSpan.textContent = 'Stopped';
        frequencySpan.textContent = '--';
        
        // Stop waveform animation
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
            clearCanvas();
        }
    });
    
    // Note change handler
    noteSelect.addEventListener('change', (e) => {
        if (audioEngine.isPlaying) {
            const note = parseInt(e.target.value);
            audioEngine.changeNote(note);
            const frequency = audioEngine.noteToFrequency(note);
            frequencySpan.textContent = frequency.toFixed(2);
        }
    });
    
    // Waveform selector handler
    waveformSelect.addEventListener('change', (e) => {
        if (e.target.value === 'fm-bell' && !audioEngine.useWasm) {
            alert('Please load the FM Bell WASM first');
            waveformSelect.value = audioEngine.currentWaveform;
            return;
        }
        audioEngine.setWaveform(e.target.value);
    });
    
    // Load WASM button handler
    loadWasmBtn.addEventListener('click', async () => {
        loadWasmBtn.disabled = true;
        loadWasmBtn.textContent = 'Loading...';
        
        const loaded = await audioEngine.loadWasmOscillator();
        
        if (loaded) {
            loadWasmBtn.textContent = 'FM Bell Loaded!';
            loadWasmBtn.classList.add('btn-success');
            
            // Enable FM Bell option
            const fmBellOption = waveformSelect.querySelector('option[value="fm-bell"]');
            fmBellOption.disabled = false;
            fmBellOption.textContent = 'FM Bell';
            
            // Select FM Bell
            waveformSelect.value = 'fm-bell';
            
            // Apply current shape value
            audioEngine.setShape(parseInt(shapeSlider.value));
        } else {
            loadWasmBtn.textContent = 'Load Failed';
            loadWasmBtn.disabled = false;
        }
    });
    
    // Shape slider handler
    shapeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        shapeValue.textContent = value;
        audioEngine.setShape(value);
    });
    
    // Volume slider handler
    volumeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        volumeValue.textContent = value + '%';
        audioEngine.setVolume(value);
    });
    
    // Waveform visualization
    function drawWaveform() {
        const data = audioEngine.getWaveformData();
        if (!data) return;
        
        // Clear canvas with gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#f8f8f8');
        gradient.addColorStop(1, '#e8e8e8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid lines
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        
        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Vertical grid lines
        for (let i = 0; i < 8; i++) {
            const x = (canvas.width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2196F3';
        ctx.beginPath();
        
        // Use only first 512 samples for cleaner display
        const samplesToShow = Math.min(512, data.length);
        const sliceWidth = canvas.width / samplesToShow;
        let x = 0;
        
        for (let i = 0; i < samplesToShow; i++) {
            const sample = data[i];
            const y = (1 - sample) * canvas.height / 2; // Invert and scale
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.stroke();
        
        // Draw shape parameter info
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.fillText(`Shape: ${audioEngine.currentShape} | Waveform: ${audioEngine.currentWaveform}`, 10, 20);
        
        // Continue animation at ~30fps
        setTimeout(() => {
            animationId = requestAnimationFrame(drawWaveform);
        }, 33);
    }
    
    function clearCanvas() {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw center line
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }
    
    // Initial canvas clear
    clearCanvas();
});