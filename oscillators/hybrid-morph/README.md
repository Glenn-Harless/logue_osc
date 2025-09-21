# Hybrid Morph Oscillator

Dual wavetable morph oscillator designed for atmospheric pads inspired by Moderat/Apparat.

## Parameters

1. **Morph** – blend between the two internal wavetables (0 = airy sine stack, 100 = filtered saw texture).
2. **Detune** – detunes the secondary oscillator around the base pitch for motion.
3. **Texture** – mixes in filtered noise for grit and width.
4. **Motion** – depth and rate of the internal morph LFO.
5. **Attack** – amplitude envelope attack time.
6. **Release** – amplitude envelope release time.

## Build

```bash
cd oscillators/hybrid-morph
make
```

## Preview in Browser

```bash
./scripts/add_oscillator.py --id hybrid-morph ... # already executed
./web-osc-preview/wasm/build-hybrid-morph.sh    # requires Emscripten
./scripts/dev_preview.py --skip-build
```

Load "Hybrid Morph" under Oscillator 3 and experiment with the new parameters.
