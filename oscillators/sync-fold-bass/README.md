# Sync Fold Bass Oscillator

Hybrid analog-style bass voice built around a hard-sync core with progressive wavefolding, a controllable sub layer, and a transient punch envelope for gritty, rubbery basses in the Modeselektor vein.

## Overview

- Master/slave hard sync keeps harmonics locked while sweeping the Shape knob.
- Wavefolder depth pushes the folded slave through multiple reflections for rich odd harmonics.
- Tilt control crossfades between folded odd content and even-heavy doubles for immediate tone shaping.
- Fixed -1 octave sub oscillator adds consistent weight independent of sync ratio.
- Drive stage and punch envelope deliver percussive attack and saturation that respond to performance gestures.

## Parameters

1. **Sync** – Sets the slave-to-master frequency ratio for hard sync sweeps. Hardware **Shape** is mapped here for live sync sweeps.
2. **Fold** – Controls the amount of wavefolding applied to the synced slave oscillator. Higher settings add richer odd harmonics.
3. **Tilt** – Crossfades between the folded odd spectrum and even-heavy content to quickly brighten or hollow out the tone.
4. **Sub Mix** – Blends in a fixed -1 octave sine sub oscillator to anchor the low end.
5. **Drive** – Pre-fold drive and soft-clipping amount for saturation. Interacts with Punch for transient aggression.
6. **Punch** – Amount of the internal short envelope that boosts fold/drive on note attacks. Hardware **Shift + Shape** targets this control.

## Implementation Notes

- Wavefolding is approximated with multiple fold stages so the character stays analog-inspired without heavy trig usage.
- Sync ratio runs from 1:1 through roughly 6.5:1 using a squared response for fine low-range control and aggressive upper sweeps.
- Tilt mixes the folded slave with a doubled phase component instead of EQ so tone changes remain phase-safe with the sub.
- Punch envelope decays between 10–180 ms, modulating both fold depth and drive to emulate analog "punch" circuits.
