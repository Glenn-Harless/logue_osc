# Kalimba Oscillator

Metallic tine plucks with a woody resonance inspired by acoustic kalimba instruments. This oscillator keeps the two-operator FM heart of `fm_bell`, but retunes the modulation, envelopes, and adds an optional body resonator plus noise burst to deliver thumb-piano transients.

## Overview

- Curated tine ratios capture familiar kalimba partials
- Dual exponential envelopes shape amplitude and brightness independently
- Blendable body resonator simulates a hollow soundboard
- Velocity subtly increases level, shimmer, and attack noise
- Noise burst parameter adds pick articulation without overpowering the tone

## Parameters

1. **Tine** – Sweeps through a set of pre-selected modulator ratios for characteristic tine timbres, from mellow fifths to bright upper partials.
2. **Brightness** – FM depth for the metallic component. Lower values are rounded and bell-like; higher values bring out the shimmering tine overtones.
3. **Decay** – Main amplitude decay time. Short settings give plucky mallet hits, longer settings sustain like amplified kalimba bars.
4. **Tone Decay** – Controls how quickly the metallic component darkens. Lower settings let the tine fade quickly into the body; higher settings keep a sparkling tail.
5. **Body** – Crossfades a resonant low-pass follower that mimics the wooden resonator. At 0 the tine is dry and bright, at 100 the body becomes warm and hollow.
6. **Noise** – Amount and length of the initial attack noise. Use small amounts for natural finger noise; increase for pick-style snaps.

## Sound Design Tips

- **Traditional Kalimba**: Tine ≈ 30, Brightness ≈ 45, Decay ≈ 35, Tone Decay ≈ 25, Body ≈ 60, Noise ≈ 20.
- **Muted Pluck**: Short Decay and Tone Decay plus higher Body for a woody, percussive thunk.
- **Shimmer Lead**: Push Brightness and Tone Decay above 70 with low Body for cutting, glassy tones that still feel organic.
- **Lo-Fi Attack**: Raise Noise and lower Brightness to emulate sampled kalimba transients through vintage samplers.

## Implementation Notes

- Ratios are interpolated from a table of commonly heard kalimba partials to avoid harsh inharmonic sweeps.
- Separate decay constants for amplitude, modulation, and noise keep the tine bright at the start but quickly mellow the release.
- The body resonator is a lightweight one-pole follower blended with the direct tine to approximate the cavity resonance without extra oscillators.
