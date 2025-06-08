# FM Bell/Metallic Oscillator

An FM synthesis oscillator designed to create bell-like, metallic, and percussive sounds perfect for tropical house and world music production in the style of Polo & Pan.

## Overview

This oscillator uses 2-operator FM synthesis with carefully tuned ratios and envelopes to create:
- Steel drum sounds
- Kalimba/thumb piano tones
- Bell-like timbres
- Metallic percussion hits
- Glass-like crystalline sounds

## Technical Design

### FM Synthesis Architecture

```
[Modulator] ---> [Carrier] ---> [Output]
     |              |
[Mod Env]      [Amp Env]
```

- **Carrier**: Produces the fundamental frequency
- **Modulator**: Creates the metallic harmonics
- **Modulation Index**: Controls brightness/metallicness
- **Ratio**: Determines harmonic character

### Key Features

1. **Non-Integer Ratios**: For inharmonic, bell-like spectra
2. **Fast Decay Envelopes**: For authentic percussion attacks
3. **Velocity Sensitivity**: Brighter sounds with harder hits
4. **Built-in Vibrato**: For steel drum authenticity

## Parameters

### 1. Ratio (1-20)
Controls the frequency ratio between modulator and carrier
- **1-3**: Harmonic, musical bells
- **3.5-7**: Steel drum territory
- **7-15**: Kalimba/metallic plucks
- **15-20**: Glass/crystal sounds

### 2. FM Depth (0-100%)
Modulation intensity (brightness control)
- **0-20%**: Soft, mellow tones
- **20-50%**: Classic FM bells
- **50-80%**: Bright metallic sounds
- **80-100%**: Harsh, clangy tones

### 3. Decay Time (0-100%)
Controls how quickly the sound fades
- **0-10%**: Very short, percussive hits
- **10-30%**: Kalimba-like plucks
- **30-60%**: Bell-like sustain
- **60-100%**: Long, singing tones

### 4. Mod Decay (0-100%)
Modulator envelope decay (timbral evolution)
- **< Carrier**: Sound gets duller over time
- **= Carrier**: Consistent timbre
- **> Carrier**: Sound gets brighter before fading

### 5. Fine Ratio (-50 to +50)
Fine-tune the ratio for micro-tonal adjustments
- Allows non-integer ratios like 3.14, 1.41, etc.
- Essential for authentic steel drum pitches

### 6. Vibrato Depth (0-100%)
Adds periodic pitch modulation
- **0%**: No vibrato
- **5-15%**: Subtle movement
- **15-30%**: Steel drum wobble
- **30-100%**: Special effects

## Sound Design Tips

### Steel Drums
- Ratio: 3.5-4.5
- FM Depth: 40-60%
- Decay: 20-40%
- Mod Decay: 15-25%
- Add 10-20% vibrato

### Kalimba
- Ratio: 7-9
- FM Depth: 30-50%
- Decay: 10-20%
- Mod Decay: 5-15%
- No vibrato

### Glass Bells
- Ratio: 13-17
- FM Depth: 20-40%
- Decay: 40-70%
- Mod Decay: 30-50%
- Minimal vibrato

### Tropical Percussion
- Ratio: 2.1-3.7
- FM Depth: 60-80%
- Decay: 5-15%
- Mod Decay: 3-10%
- No vibrato

## Implementation Notes

### Optimization Strategies
1. Pre-calculate ratio multipliers
2. Use lookup tables for envelope curves
3. Implement fast sine approximation
4. Consider fixed-point math for efficiency

### DSP Considerations
- Anti-aliasing for high modulation indices
- Smooth parameter changes to avoid clicks
- Careful gain staging to prevent clipping

### Envelope Design
- Exponential decay curves for natural sound
- Optional pitch envelope for "boing" effects
- Velocity scales both FM depth and amplitude

## Future Enhancements
- 3-operator mode for complex timbres
- Formant filter for more organic sounds
- Microtuning tables for world scales
- Built-in reverb send for space