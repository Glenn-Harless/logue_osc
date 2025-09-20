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

    const osc1Controls = createBuiltInBindings('osc1');
    const osc2Controls = createBuiltInBindings('osc2');
    const userSelect = document.getElementById('osc3-select');
    const userLoadBtn = document.getElementById('osc3-load');
    const userStatus = document.getElementById('osc3-status');
    const userLevelSlider = document.getElementById('osc3-level');
    const userLevelValue = document.getElementById('osc3-level-value');
    const userParamContainer = document.getElementById('osc3-parameters');

    const seqToggleBtn = document.getElementById('seq-toggle');
    const seqPatternSelect = document.getElementById('seq-pattern');
    const seqTempoSlider = document.getElementById('seq-tempo');
    const seqTempoValue = document.getElementById('seq-tempo-value');
    const seqOctaveSelect = document.getElementById('seq-octave');
    const seqStatus = document.getElementById('seq-status');

    const modToggleBtn = document.getElementById('mod-toggle');
    const modTargetSelect = document.getElementById('mod-target');
    const modRateSlider = document.getElementById('mod-rate');
    const modRateValue = document.getElementById('mod-rate-value');
    const modDepthSlider = document.getElementById('mod-depth');
    const modDepthValue = document.getElementById('mod-depth-value');
    const modStatus = document.getElementById('mod-status');

    const presetNameInput = document.getElementById('preset-name');
    const presetSaveBtn = document.getElementById('preset-save');
    const presetClearBtn = document.getElementById('preset-clear');
    const presetListSelect = document.getElementById('preset-list');
    const presetLoadBtn = document.getElementById('preset-load');
    const presetDeleteBtn = document.getElementById('preset-delete');

    if (!userSelect || !userLoadBtn || !userStatus || !userLevelSlider || !userLevelValue || !userParamContainer
        || !seqToggleBtn || !seqPatternSelect || !seqTempoSlider || !seqTempoValue || !seqOctaveSelect || !seqStatus
        || !modToggleBtn || !modTargetSelect || !modRateSlider || !modRateValue || !modDepthSlider || !modDepthValue || !modStatus
        || !presetNameInput || !presetSaveBtn || !presetClearBtn || !presetListSelect || !presetLoadBtn || !presetDeleteBtn) {
        console.error('Test tool or user oscillator controls missing from DOM');
        return;
    }

    const manifestCache = new Map();
    let manifestIndex = [];
    let currentManifest = null;
    let currentManifestParams = [];

    const modTargetMeta = new Map();
    const modState = {
        active: false,
        frameId: null,
        meta: null,
        baseValue: 0,
        amplitude: 0,
        phase: 0,
        lastTime: 0,
        rateHz: 0
    };

    const SEQUENCER_PATTERNS = {
        'arp-up': [0, 4, 7, 12],
        'arp-down': [12, 7, 4, 0],
        'pentatonic': [0, 2, 4, 7, 9, 12],
        'chord': [0, 3, 7, 10],
        'random': []
    };

    const sequencerState = {
        active: false,
        timerId: null,
        baseNote: 60,
        step: 0,
        startedEngine: false
    };

    const presetStore = createPresetStore();
    refreshPresetList();

    let animationId = null;

    try {
        manifestIndex = await fetchManifestIndex();
        populateUserSelect(manifestIndex, userSelect);
    } catch (err) {
        console.error('Failed to load oscillator manifest index:', err);
    }

    osc1Controls.applyInitial(audioEngine.getVoice('osc1'));
    osc2Controls.applyInitial(audioEngine.getVoice('osc2'));
    userLevelValue.textContent = `${userLevelSlider.value}%`;
    audioEngine.setVoiceLevel('osc3', parseInt(userLevelSlider.value, 10));
    masterVolumeValue.textContent = `${masterVolumeSlider.value}%`;
    audioEngine.setVolume(parseInt(masterVolumeSlider.value, 10));
    updateTempoDisplay();
    updateModRateDisplay();
    updateModDepthDisplay();
    updateModTargets(null);

    playBtn.addEventListener('click', async () => {
        const note = parseInt(noteSelect.value, 10);
        const frequency = await audioEngine.play(note);

        playBtn.disabled = true;
        stopBtn.disabled = false;
        updateTransportStatus('Playing', frequency.toFixed(2));
        drawWaveform();
    });

    stopBtn.addEventListener('click', async () => {
        await audioEngine.stop();
        stopSequencer({ stopAudio: false });
        stopModulation({ resetValue: true });
        playBtn.disabled = false;
        stopBtn.disabled = true;
        updateTransportStatus('Stopped', '--');
        cancelWaveform();
    });

    noteSelect.addEventListener('change', (event) => {
        const note = parseInt(event.target.value, 10);
        sequencerState.baseNote = note;
        audioEngine.changeNote(note);
        if (audioEngine.isPlaying) {
            const frequency = audioEngine.noteToFrequency(note);
            updateTransportStatus('Playing', frequency.toFixed(2));
        }
    });

    masterVolumeSlider.addEventListener('input', (event) => {
        const value = parseInt(event.target.value, 10);
        masterVolumeValue.textContent = `${value}%`;
        audioEngine.setVolume(value);
    });

    osc1Controls.bind();
    osc2Controls.bind();

    userLevelSlider.addEventListener('input', (event) => {
        const value = parseInt(event.target.value, 10);
        userLevelValue.textContent = `${value}%`;
        audioEngine.setVoiceLevel('osc3', value);
    });

    userLoadBtn.addEventListener('click', async () => {
        const selectedId = userSelect.value;
        const selectedMeta = manifestIndex.find((entry) => entry.id === selectedId);
        if (!selectedMeta) {
            alert('Select an oscillator to load.');
            return;
        }

        await loadManifestAndApply(selectedMeta);
    });

    seqTempoSlider.addEventListener('input', () => {
        updateTempoDisplay();
    });

    seqToggleBtn.addEventListener('click', async () => {
        if (sequencerState.active) {
            stopSequencer({ stopAudio: true });
        } else {
            await startSequencer();
        }
    });

    modRateSlider.addEventListener('input', updateModRateDisplay);
    modDepthSlider.addEventListener('input', updateModDepthDisplay);

    modTargetSelect.addEventListener('change', () => {
        if (modState.active) {
            stopModulation({ resetValue: true });
        }
        modStatus.textContent = modTargetSelect.value ? 'Ready' : 'Idle';
    });

    modToggleBtn.addEventListener('click', () => {
        if (modState.active) {
            stopModulation({ resetValue: true });
        } else {
            startModulation();
        }
    });

    presetSaveBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            alert('Enter a name for the preset.');
            return;
        }
        const preset = captureCurrentPreset(name);
        presetStore.save(preset);
        refreshPresetList(name);
    });

    presetClearBtn.addEventListener('click', () => {
        presetNameInput.value = '';
    });

    presetLoadBtn.addEventListener('click', async () => {
        const preset = getSelectedPreset();
        if (!preset) {
            alert('Select a preset to load.');
            return;
        }
        await applyPreset(preset);
    });

    presetDeleteBtn.addEventListener('click', () => {
        const preset = getSelectedPreset();
        if (!preset) {
            alert('Select a preset to delete.');
            return;
        }
        if (confirm(`Delete preset "${preset.name}"?`)) {
            presetStore.remove(preset.id);
            refreshPresetList();
        }
    });

    function updateTempoDisplay() {
        seqTempoValue.textContent = `${seqTempoSlider.value} BPM`;
    }

    function updateModRateDisplay() {
        const rateHz = parseInt(modRateSlider.value, 10) / 100;
        modRateValue.textContent = `${rateHz.toFixed(2)} Hz`;
    }

    function updateModDepthDisplay() {
        modDepthValue.textContent = `${modDepthSlider.value}%`;
    }

    function createPresetStore() {
        const STORAGE_KEY = 'logue_presets_v1';

        function loadAll() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (err) {
                console.warn('Failed to parse preset store:', err);
            }
            return [];
        }

        function saveAll(presets) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
        }

        return {
            list() {
                return loadAll();
            },
            save(preset) {
                const presets = loadAll();
                const existingIndex = presets.findIndex((p) => p.id === preset.id);
                if (existingIndex >= 0) {
                    presets[existingIndex] = preset;
                } else {
                    presets.push(preset);
                }
                saveAll(presets);
            },
            remove(id) {
                saveAll(loadAll().filter((preset) => preset.id !== id));
            }
        };
    }

    function refreshPresetList(selectId) {
        const presets = presetStore.list();
        presetListSelect.innerHTML = '';
        if (!presets.length) {
            const option = document.createElement('option');
            option.textContent = 'No presets saved';
            option.disabled = true;
            presetListSelect.appendChild(option);
            presetListSelect.disabled = true;
            presetLoadBtn.disabled = true;
            presetDeleteBtn.disabled = true;
            return;
        }

        presetListSelect.disabled = false;
        presetLoadBtn.disabled = false;
        presetDeleteBtn.disabled = false;

        presets.forEach((preset) => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            presetListSelect.appendChild(option);
        });

        if (selectId && presets.some((preset) => preset.id === selectId)) {
            presetListSelect.value = selectId;
        } else {
            presetListSelect.selectedIndex = 0;
        }
    }

    function captureCurrentPreset(name) {
        const userVoice = audioEngine.getVoice('osc3');
        const preset = {
            id: generatePresetId(name),
            name,
            createdAt: Date.now(),
            manifestId: (currentManifest && currentManifest.id) || null,
            voices: {
                osc1: captureBuiltinVoice('osc1'),
                osc2: captureBuiltinVoice('osc2'),
                osc3: {
                    level: Math.round(userVoice.level * 100),
                    params: Array.from(userVoice.params.entries())
                }
            },
            sequencer: {
                pattern: seqPatternSelect.value,
                tempo: parseInt(seqTempoSlider.value, 10),
                octaveSpan: parseInt(seqOctaveSelect.value, 10)
            },
            modulation: {
                target: modTargetSelect.value,
                rate: parseInt(modRateSlider.value, 10),
                depth: parseInt(modDepthSlider.value, 10)
            }
        };
        return preset;
    }

    function captureBuiltinVoice(id) {
        const voice = audioEngine.getVoice(id);
        return {
            waveform: voice.waveform,
            level: Math.round(voice.level * 100),
            shape: voice.shape
        };
    }

    function generatePresetId(name) {
        return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    }

    function getSelectedPreset() {
        const id = presetListSelect.value;
        if (!id) {
            return null;
        }
        return presetStore.list().find((preset) => preset.id === id) || null;
    }

    async function applyPreset(preset) {
        if (!preset) {
            return;
        }

        const osc1 = preset.voices.osc1;
        const osc2 = preset.voices.osc2;
        const osc3 = preset.voices.osc3;

        audioEngine.setBuiltinWaveform('osc1', osc1.waveform);
        audioEngine.setVoiceLevel('osc1', osc1.level);
        audioEngine.setBuiltinShape('osc1', osc1.shape);
        osc1Controls.setShapeValue(osc1.shape);

        audioEngine.setBuiltinWaveform('osc2', osc2.waveform);
        audioEngine.setVoiceLevel('osc2', osc2.level);
        audioEngine.setBuiltinShape('osc2', osc2.shape);
        osc2Controls.setShapeValue(osc2.shape);

        audioEngine.setVoiceLevel('osc3', osc3.level);
        userLevelSlider.value = String(osc3.level);
        userLevelValue.textContent = `${osc3.level}%`;

        if (preset.manifestId && (!currentManifest || currentManifest.id !== preset.manifestId)) {
            const manifestEntry = manifestIndex.find((entry) => entry.id === preset.manifestId);
            if (manifestEntry) {
                const loaded = await loadManifestAndApply(manifestEntry, { quiet: true });
                if (!loaded) {
                    alert('Preset loaded, but user oscillator failed to load.');
                }
            }
        }

        const osc3Voice = audioEngine.getVoice('osc3');
        const userParamMap = new Map(osc3.params);
        osc3Voice.params = userParamMap;
        userParamMap.forEach((value, index) => {
            audioEngine.setUserParam(index, value);
        });

        updateUserParamControls(userParamMap);

        seqPatternSelect.value = preset.sequencer.pattern || 'arp-up';
        seqTempoSlider.value = String(preset.sequencer.tempo || 110);
        seqOctaveSelect.value = String(preset.sequencer.octaveSpan || 0);
        updateTempoDisplay();

        modTargetSelect.value = preset.modulation.target || '';
        modRateSlider.value = String(preset.modulation.rate || 120);
        modDepthSlider.value = String(preset.modulation.depth || 60);
        updateModRateDisplay();
        updateModDepthDisplay();
        modStatus.textContent = modTargetSelect.value ? 'Ready' : 'Idle';
    }

    function updateUserParamControls(paramEntries) {
        paramEntries.forEach((value, index) => {
            updateUserParamSlider(index, value);
        });
    }

    function renderUserParameters(manifest) {
        userParamContainer.innerHTML = '';
        if (!manifest.parameters || manifest.parameters.length === 0) {
            const info = document.createElement('div');
            info.className = 'parameter-description';
            info.textContent = 'No parameters exposed for this oscillator.';
            userParamContainer.appendChild(info);
            return;
        }

        const groups = new Map();
        manifest.parameters.forEach((param) => {
            const defaultValue = param.default ?? param.min ?? 0;
            const initialValue = audioEngine.hasUserParam(param.index)
                ? audioEngine.getUserParam(param.index)
                : defaultValue;

            audioEngine.setUserParam(param.index, initialValue);

            const groupName = param.group || 'General';
            if (!groups.has(groupName)) {
                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'parameter-group';

                const groupHeading = document.createElement('h3');
                groupHeading.textContent = groupName;
                groupWrapper.appendChild(groupHeading);

                const groupBody = document.createElement('div');
                groupBody.className = 'parameter-grid';
                groupWrapper.appendChild(groupBody);

                userParamContainer.appendChild(groupWrapper);
                groups.set(groupName, groupBody);
            }

            createRangeControl({
                container: groups.get(groupName),
                label: param.name,
                min: param.min,
                max: param.max,
                value: initialValue,
                description: param.description,
                paramIndex: param.index,
                onInput: (value) => audioEngine.setUserParam(param.index, value)
            });
        });
    }

    function applyManifestDefaults(manifest) {
        if (manifest.defaultLevel !== undefined) {
            const level = Math.max(0, Math.min(100, Math.round(manifest.defaultLevel)));
            userLevelSlider.value = String(level);
            userLevelValue.textContent = `${level}%`;
            audioEngine.setVoiceLevel('osc3', level);
        }
        updateModTargets(manifest);
    }

    function startModulation() {
        const targetId = modTargetSelect.value;
        if (!targetId) {
            alert('Select a parameter to modulate.');
            return;
        }

        const meta = modTargetMeta.get(targetId);
        if (!meta) {
            alert('Selected parameter is unavailable.');
            return;
        }

        const depthPercent = parseInt(modDepthSlider.value, 10) / 100;
        if (depthPercent <= 0) {
            alert('Increase modulation depth to hear changes.');
            return;
        }

        const baseValue = meta.getter();
        const amplitude = ((meta.max - meta.min) * depthPercent) / 2;
        if (amplitude <= 0) {
            alert('Depth is too small for this parameter range.');
            return;
        }

        modState.active = true;
        modState.meta = meta;
        modState.baseValue = baseValue;
        modState.amplitude = amplitude;
        modState.phase = 0;
        modState.lastTime = 0;
        modState.rateHz = parseInt(modRateSlider.value, 10) / 100;

        modToggleBtn.textContent = 'Stop Modulation';
        modStatus.textContent = 'Running';
        modState.frameId = requestAnimationFrame(modulationLoop);
    }

    function modulationLoop(timestamp) {
        if (!modState.active || !modState.meta) {
            return;
        }

        if (!modState.lastTime) {
            modState.lastTime = timestamp;
        }
        const deltaSeconds = (timestamp - modState.lastTime) / 1000;
        modState.lastTime = timestamp;

        modState.phase += 2 * Math.PI * modState.rateHz * deltaSeconds;
        const rawValue = modState.baseValue + Math.sin(modState.phase) * modState.amplitude;
        const clamped = Math.round(Math.min(modState.meta.max, Math.max(modState.meta.min, rawValue)));

        modState.meta.setter(clamped);
        modState.frameId = requestAnimationFrame(modulationLoop);
    }

    function stopModulation({ resetValue } = { resetValue: false }) {
        if (modState.frameId) {
            cancelAnimationFrame(modState.frameId);
            modState.frameId = null;
        }
        if (!modState.active) {
            return;
        }

        if (resetValue && modState.meta) {
            modState.meta.setter(Math.round(modState.baseValue));
        }

        modState.active = false;
        modState.meta = null;
        modToggleBtn.textContent = 'Start Modulation';
        modStatus.textContent = modTargetSelect.value ? 'Ready' : 'Idle';
    }

    async function startSequencer() {
        if (sequencerState.active) {
            return;
        }

        const baseNote = parseInt(noteSelect.value, 10);
        sequencerState.baseNote = baseNote;
        sequencerState.step = 0;
        sequencerState.startedEngine = !audioEngine.isPlaying;
        sequencerState.active = true;

        if (sequencerState.startedEngine) {
            await audioEngine.play(baseNote);
        } else {
            audioEngine.changeNote(baseNote);
        }

        updateTransportStatus('Playing', audioEngine.noteToFrequency(baseNote).toFixed(2));
        seqToggleBtn.textContent = 'Stop Sequencer';
        seqStatus.textContent = 'Running';
        scheduleNextSequencerStep();
    }

    function stopSequencer({ stopAudio } = { stopAudio: false }) {
        if (sequencerState.timerId) {
            clearTimeout(sequencerState.timerId);
            sequencerState.timerId = null;
        }
        if (!sequencerState.active) {
            return;
        }

        const shouldStopAudio = stopAudio && sequencerState.startedEngine;
        sequencerState.active = false;
        const wasStartedEngine = sequencerState.startedEngine;
        sequencerState.startedEngine = false;
        seqToggleBtn.textContent = 'Start Sequencer';
        seqStatus.textContent = 'Stopped';

        if (shouldStopAudio) {
            audioEngine.stop();
        } else if (wasStartedEngine) {
            audioEngine.stop();
        }
    }

    function scheduleNextSequencerStep() {
        if (!sequencerState.active) {
            return;
        }

        const tempoBpm = parseInt(seqTempoSlider.value, 10);
        const intervalMs = (60 / tempoBpm) * 1000;

        sequencerState.timerId = setTimeout(async () => {
            if (!sequencerState.active) {
                return;
            }
            sequencerState.step += 1;
            const nextNote = computeSequencerNote(sequencerState.step, sequencerState.baseNote);
            await audioEngine.changeNote(nextNote);
            updateTransportStatus('Playing', audioEngine.noteToFrequency(nextNote).toFixed(2));
            scheduleNextSequencerStep();
        }, intervalMs);
    }

    function computeSequencerNote(stepIndex, baseNote) {
        const patternId = seqPatternSelect.value;
        const offsets = SEQUENCER_PATTERNS[patternId] || [0];
        if (patternId === 'random') {
            const span = parseInt(seqOctaveSelect.value, 10) + 1;
            const maxOffset = 12 * span;
            const offset = Math.floor(Math.random() * (maxOffset + 1));
            return baseNote + offset;
        }

        const octaveSpan = parseInt(seqOctaveSelect.value, 10) + 1;
        const patternLength = offsets.length;
        const patternIndex = stepIndex % patternLength;
        const octave = Math.floor((stepIndex / patternLength) % octaveSpan);
        const offset = offsets[patternIndex] + octave * 12;
        return baseNote + offset;
    }

    function createRangeControl({ container, label, min, max, value, description, onInput, paramIndex }) {
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
        if (typeof paramIndex === 'number') {
            slider.dataset.paramIndex = String(paramIndex);
        }
        wrapper.appendChild(slider);

        const valueEl = document.createElement('div');
        valueEl.className = 'parameter-value';
        valueEl.textContent = `${value}`;
        if (typeof paramIndex === 'number') {
            valueEl.dataset.paramIndex = String(paramIndex);
        }
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

        const updateShapeDisplay = (value) => {
            shapeSlider.value = String(value);
            shapeValue.textContent = `${value}`;
        };

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
                updateShapeDisplay(voice.shape);
                const levelPercent = Math.round(voice.level * 100);
                levelSlider.value = levelPercent;
                levelValue.textContent = `${levelPercent}%`;
            },
            getShapeValue() {
                return parseInt(shapeSlider.value, 10);
            },
            setShapeValue(value) {
                updateShapeDisplay(value);
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

    async function loadManifestAndApply(manifestEntry, options = {}) {
        if (!manifestEntry) {
            return false;
        }

        const quiet = Boolean(options.quiet);

        if (!quiet) {
            userLoadBtn.textContent = 'Loading...';
            userStatus.textContent = 'Loading manifest...';
        }
        userLoadBtn.disabled = true;

        try {
            const manifest = await loadManifest(manifestEntry.manifest, manifestCache);
            const result = await audioEngine.loadUserOscillator(manifest);
            currentManifest = manifest;
            currentManifestParams = Array.isArray(manifest.parameters) ? manifest.parameters : [];
            renderUserParameters(manifest);
            applyManifestDefaults(manifest);
            const voice = audioEngine.getVoice('osc3');
            const usingFallback = result.status === 'fallback' || voice.isFallback;
            userStatus.textContent = usingFallback ? 'Loaded (JS fallback)' : 'Loaded (WASM)';
            userLoadBtn.textContent = 'Reload';
            return true;
        } catch (err) {
            console.error('Failed to load user oscillator:', err);
            currentManifest = null;
            currentManifestParams = [];
            updateModTargets(null);
            if (!quiet) {
                userStatus.textContent = 'Load failed';
                userLoadBtn.textContent = 'Retry';
            }
            return false;
        } finally {
            userLoadBtn.disabled = false;
        }
    }

    function updateModTargets(manifest) {
        const previousTarget = modTargetSelect.value;
        modTargetMeta.clear();
        modTargetSelect.innerHTML = '';

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'None';
        modTargetSelect.appendChild(noneOption);

        registerBuiltinModTargets();

        if (manifest && Array.isArray(manifest.parameters)) {
            manifest.parameters.forEach((param) => {
                modTargetMeta.set(`param-${param.index}`, {
                    type: 'user',
                    index: param.index,
                    min: param.min,
                    max: param.max,
                    getter: () => audioEngine.getUserParam(param.index),
                    setter: (value) => {
                        audioEngine.setUserParam(param.index, value);
                        updateUserParamSlider(param.index, value);
                    }
                });

                const option = document.createElement('option');
                option.value = `param-${param.index}`;
                option.textContent = `Osc 3: ${param.name}`;
                modTargetSelect.appendChild(option);
            });
        }

        if (previousTarget && modTargetMeta.has(previousTarget)) {
            modTargetSelect.value = previousTarget;
        } else {
            modTargetSelect.value = '';
            stopModulation({ resetValue: false });
        }

        modStatus.textContent = modTargetSelect.value ? 'Ready' : 'Idle';
    }

    function registerBuiltinModTargets() {
        modTargetMeta.set('osc1-shape', {
            type: 'builtin',
            min: 0,
            max: 1023,
            getter: () => osc1Controls.getShapeValue(),
            setter: (value) => {
                osc1Controls.setShapeValue(value);
                audioEngine.setBuiltinShape('osc1', value);
            }
        });

        modTargetMeta.set('osc2-shape', {
            type: 'builtin',
            min: 0,
            max: 1023,
            getter: () => osc2Controls.getShapeValue(),
            setter: (value) => {
                osc2Controls.setShapeValue(value);
                audioEngine.setBuiltinShape('osc2', value);
            }
        });

        const option1 = document.createElement('option');
        option1.value = 'osc1-shape';
        option1.textContent = 'Osc 1 Shape';
        modTargetSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = 'osc2-shape';
        option2.textContent = 'Osc 2 Shape';
        modTargetSelect.appendChild(option2);
    }

    function updateUserParamSlider(paramIndex, value) {
        const slider = userParamContainer.querySelector(`input[data-param-index="${paramIndex}"]`);
        if (slider) {
            slider.value = String(value);
            const valueEl = slider.parentElement.querySelector(`.parameter-value[data-param-index="${paramIndex}"]`);
            if (valueEl) {
                valueEl.textContent = `${value}`;
            }
        }
    }

    function updateTransportStatus(state, frequency) {
        const statusSpan = document.getElementById('status');
        const frequencySpan = document.getElementById('frequency');
        if (statusSpan) statusSpan.textContent = state;
        if (frequencySpan) frequencySpan.textContent = frequency;
    }

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
            const manifestName = currentManifest ? currentManifest.name || 'user' : 'user';
            summary.push(`O3:${manifestName}${osc3.isFallback ? '(js)' : '(wasm)'}`);
        } else {
            summary.push('O3:empty');
        }
        return summary.join(' | ');
    }
});
