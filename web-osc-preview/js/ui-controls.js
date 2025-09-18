// UI Control handlers
document.addEventListener('DOMContentLoaded', async () => {
    const playBtn = document.getElementById('play');
    const stopBtn = document.getElementById('stop');
    const noteSelect = document.getElementById('note');
    const masterVolumeSlider = document.getElementById('master-volume');
    const masterVolumeValue = document.getElementById('master-volume-value');
    const canvas = document.getElementById('waveform-display');
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (!playBtn || !stopBtn || !noteSelect || !masterVolumeSlider || !canvas || !ctx) {
        console.error('Required elements missing from DOM');
        return;
    }

    // Oscillator controls
    const osc1Controls = createBuiltInBindings('osc1');
    const osc2Controls = createBuiltInBindings('osc2');
    const userSelect = document.getElementById('osc3-select');
    const userLoadBtn = document.getElementById('osc3-load');
    const userStatus = document.getElementById('osc3-status');
    const userLevelSlider = document.getElementById('osc3-level');
    const userLevelValue = document.getElementById('osc3-level-value');
    const userParamContainer = document.getElementById('osc3-parameters');

    if (!userSelect || !userLoadBtn || !userStatus || !userLevelSlider || !userLevelValue || !userParamContainer) {
        console.error('User oscillator controls missing from DOM');
        return;
    }

    const manifestCache = new Map();
    let manifestIndex = [];
    let currentManifest = null;

    try {
        manifestIndex = await fetchManifestIndex();
        populateUserSelect(manifestIndex, userSelect);
    } catch (err) {
        console.error('Failed to load oscillator manifest index:', err);
    }

    // Initialize engine with default slider positions
    osc1Controls.applyInitial(audioEngine.getVoice('osc1'));
    osc2Controls.applyInitial(audioEngine.getVoice('osc2'));
    userLevelValue.textContent = `${userLevelSlider.value}%`;
    audioEngine.setVoiceLevel('osc3', parseInt(userLevelSlider.value, 10));
    masterVolumeValue.textContent = `${masterVolumeSlider.value}%`;
    audioEngine.setVolume(parseInt(masterVolumeSlider.value, 10));

    // Play button handler
    playBtn.addEventListener('click', async () => {
        const note = parseInt(noteSelect.value, 10);
        const frequency = await audioEngine.play(note);

        playBtn.disabled = true;
        stopBtn.disabled = false;
        updateTransportStatus('Playing', frequency.toFixed(2));
        drawWaveform();
    });

    // Stop button handler
    stopBtn.addEventListener('click', async () => {
        await audioEngine.stop();
        playBtn.disabled = false;
        stopBtn.disabled = true;
        updateTransportStatus('Stopped', '--');
        cancelWaveform();
    });

    // Note change handler
    noteSelect.addEventListener('change', (event) => {
        const note = parseInt(event.target.value, 10);
        audioEngine.changeNote(note);
        if (audioEngine.isPlaying) {
            const frequency = audioEngine.noteToFrequency(note);
            updateTransportStatus('Playing', frequency.toFixed(2));
        }
    });

    // Master volume handler
    masterVolumeSlider.addEventListener('input', (event) => {
        const value = parseInt(event.target.value, 10);
        masterVolumeValue.textContent = `${value}%`;
        audioEngine.setVolume(value);
    });

    // Built-in oscillator handlers
    osc1Controls.bind();
    osc2Controls.bind();

    // User oscillator level
    userLevelSlider.addEventListener('input', (event) => {
        const value = parseInt(event.target.value, 10);
        userLevelValue.textContent = `${value}%`;
        audioEngine.setVoiceLevel('osc3', value);
    });

    // User oscillator loading
    userLoadBtn.addEventListener('click', async () => {
        const selectedId = userSelect.value;
        const selectedMeta = manifestIndex.find((entry) => entry.id === selectedId);
        if (!selectedMeta) {
            alert('Select an oscillator to load.');
            return;
        }

        userLoadBtn.disabled = true;
        userLoadBtn.textContent = 'Loading...';
        userStatus.textContent = 'Loading manifest...';

        try {
            const manifest = await loadManifest(selectedMeta.manifest, manifestCache);
            const result = await audioEngine.loadUserOscillator(manifest);
            currentManifest = manifest;
            renderUserParameters(manifest);
            const voice = audioEngine.getVoice('osc3');
            const usingFallback = result.status === 'fallback' || voice.isFallback;
            userStatus.textContent = usingFallback ? 'Loaded (JS fallback)' : 'Loaded (WASM)';
            userLoadBtn.textContent = 'Reload';
            userLoadBtn.disabled = false;
        } catch (err) {
            console.error('Failed to load user oscillator:', err);
            userStatus.textContent = 'Load failed';
            userLoadBtn.textContent = 'Retry';
            userLoadBtn.disabled = false;
        }
    });

    function renderUserParameters(manifest) {
        userParamContainer.innerHTML = '';
        if (!manifest.parameters || manifest.parameters.length === 0) {
            const info = document.createElement('div');
            info.className = 'parameter-description';
            info.textContent = 'No parameters exposed for this oscillator.';
            userParamContainer.appendChild(info);
            return;
        }

        manifest.parameters.forEach((param) => {
            const defaultValue = param.default ?? param.min ?? 0;
            const initialValue = audioEngine.hasUserParam(param.index)
                ? audioEngine.getUserParam(param.index)
                : defaultValue;

            audioEngine.setUserParam(param.index, initialValue);

            createRangeControl({
                container: userParamContainer,
                label: param.name,
                min: param.min,
                max: param.max,
                value: initialValue,
                description: param.description,
                onInput: (value) => audioEngine.setUserParam(param.index, value)
            });
        });
    }

    function createRangeControl({ container, label, min, max, value, description, onInput }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'parameter-control';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        wrapper.appendChild(labelEl);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.value = value;
        wrapper.appendChild(slider);

        const valueEl = document.createElement('div');
        valueEl.className = 'parameter-value';
        valueEl.textContent = `${value}`;
        wrapper.appendChild(valueEl);

        if (description) {
            const descEl = document.createElement('div');
            descEl.className = 'parameter-description';
            descEl.textContent = description;
            wrapper.appendChild(descEl);
        }

        slider.addEventListener('input', (event) => {
            const newValue = parseInt(event.target.value, 10);
            valueEl.textContent = `${newValue}`;
            onInput(newValue);
        });

        container.appendChild(wrapper);
    }

    function createBuiltInBindings(id) {
        const waveformSelect = document.getElementById(`${id}-waveform`);
        const shapeSlider = document.getElementById(`${id}-shape`);
        const shapeValue = document.getElementById(`${id}-shape-value`);
        const levelSlider = document.getElementById(`${id}-level`);
        const levelValue = document.getElementById(`${id}-level-value`);

        if (!waveformSelect || !shapeSlider || !shapeValue || !levelSlider || !levelValue) {
            throw new Error(`Missing controls for ${id}`);
        }

        return {
            bind() {
                waveformSelect.addEventListener('change', (event) => {
                    audioEngine.setBuiltinWaveform(id, event.target.value);
                });

                shapeSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    shapeValue.textContent = `${value}`;
                    audioEngine.setBuiltinShape(id, value);
                });

                levelSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    levelValue.textContent = `${value}%`;
                    audioEngine.setVoiceLevel(id, value);
                });
            },
            applyInitial(voice) {
                if (!voice) return;
                waveformSelect.value = voice.waveform;
                shapeSlider.value = voice.shape;
                shapeValue.textContent = `${voice.shape}`;
                const levelPercent = Math.round(voice.level * 100);
                levelSlider.value = levelPercent;
                levelValue.textContent = `${levelPercent}%`;
            }
        };
    }

    async function fetchManifestIndex() {
        const response = await fetch('manifests/index.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.oscillators || [];
    }

    function populateUserSelect(index, select) {
        select.innerHTML = '';
        if (!index.length) {
            const option = document.createElement('option');
            option.textContent = 'No custom oscillators found';
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            userLoadBtn.disabled = true;
            return;
        }

        index.forEach((entry) => {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = entry.name;
            select.appendChild(option);
        });
    }

    async function loadManifest(path, cache) {
        if (cache.has(path)) {
            return cache.get(path);
        }
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const manifest = await response.json();
        cache.set(path, manifest);
        return manifest;
    }

    function updateTransportStatus(state, frequency) {
        const statusSpan = document.getElementById('status');
        const frequencySpan = document.getElementById('frequency');
        if (statusSpan) statusSpan.textContent = state;
        if (frequencySpan) frequencySpan.textContent = frequency;
    }

    let animationId = null;

    function drawWaveform() {
        const data = audioEngine.getWaveformData();
        if (!data) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#f8f8f8');
        gradient.addColorStop(1, '#e8e8e8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        for (let i = 0; i < 8; i++) {
            const x = (canvas.width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2196F3';
        ctx.beginPath();

        const samplesToShow = Math.min(512, data.length);
        const sliceWidth = canvas.width / samplesToShow;
        let x = 0;

        for (let i = 0; i < samplesToShow; i++) {
            const sample = data[i];
            const y = (1 - sample) * canvas.height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();

        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.fillText(engineSummary(), 10, 20);

        animationId = requestAnimationFrame(drawWaveform);
    }

    function cancelWaveform() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    function engineSummary() {
        const osc1 = audioEngine.getVoice('osc1');
        const osc2 = audioEngine.getVoice('osc2');
        const osc3 = audioEngine.getVoice('osc3');
        const summary = [
            `O1:${osc1.waveform}@${Math.round(osc1.level * 100)}%`,
            `O2:${osc2.waveform}@${Math.round(osc2.level * 100)}%`
        ];
        if (osc3.loaded) {
            const manifestName = currentManifest ? currentManifest.name || "user" : 'user';
            summary.push(`O3:${manifestName}${osc3.isFallback ? '(js)' : '(wasm)'}`);
        } else {
            summary.push('O3:empty');
        }
        return summary.join(' | ');
    }

    // Prime waveform canvas
    cancelWaveform();
});
