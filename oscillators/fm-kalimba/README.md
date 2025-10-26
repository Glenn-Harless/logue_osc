# Kalimba Oscillator

Metallic tine plucks with a woody resonance inspired by acoustic kalimba instruments. This oscillator keeps the two-operator FM heart of `fm_bell`, but retunes the modulation, envelopes, and adds an optional body resonator plus noise burst to deliver thumb-piano transients.

## Overview

- Curated harmonic ratios capture familiar kalimba partials
- Dual exponential envelopes shape amplitude and brightness independently
- Blendable body resonator simulates a hollow soundboard
- Velocity subtly increases level, shimmer, and attack noise
- Noise burst parameter adds pick articulation without overpowering the tone
- Default tuning sits a pair of octaves higher so the lowest key lands in a comfortable thumb-piano register on hardware.

## Parameters

1. **Harmonics** – Sweeps through pre-selected tine partial ratios, moving from mellow fifths to bright upper overtones. The hardware **Shape** knob is mapped here for quick performance control.
2. **Brightness** – FM depth for the metallic component. Lower values stay rounded; higher settings emphasize the sparkling tine bite.
3. **Decay** – Main amplitude decay. Short settings give tight plucks, longer settings sustain like amplified kalimba bars. Default is voiced around 13% for a natural ring.
4. **Tone Decay** – Controls how quickly the metallic component darkens. Lower settings let the tine fade into the body; higher settings keep a shimmering tail.
5. **Body** – Crossfades a resonant follower that mimics the wooden soundboard. At 0 the tine is dry; at 100 the cavity resonance becomes warm and prominent.
6. **Noise** – Amount and length of the attack noise. Dial in subtle finger scrape or push higher for pick-style snaps; the envelope lengthens with higher values.

## Sound Design Tips

- **Traditional Kalimba**: Harmonics ≈ 30, Brightness ≈ 45, Decay ≈ 35, Tone Decay ≈ 25, Body ≈ 60, Noise ≈ 20.
- **Muted Pluck**: Short Decay and Tone Decay plus higher Body for a woody, percussive thunk.
- **Shimmer Lead**: Push Brightness and Tone Decay above 70 with low Body for cutting, glassy tones that still feel organic.
- **Lo-Fi Attack**: Raise Noise and lower Brightness to emulate sampled kalimba transients through vintage samplers.

## Implementation Notes

- Ratios are interpolated from a table of commonly heard kalimba partials to avoid harsh inharmonic sweeps.
- Separate decay constants for amplitude, modulation, and noise keep the tine bright at the start but quickly mellow the release.
- The oscillator now runs an octave lower by default, leaving more usable range on the keyboard without altering pitch tracking.
- The body resonator is a lightweight one-pole follower blended with the direct tine to approximate the cavity resonance without extra oscillators.
**Shift + Shape** targets **Tone Decay**, letting you lengthen or shorten the metallic tail without leaving performance mode.
