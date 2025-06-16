# FM Bell Oscillator - Usage Guide

## Summary of Changes (v5)

1. **Fixed Initialization**: The oscillator now starts with audible default values:
   - Ratio: 3.5 (bell-like harmonic ratio)
   - FM Depth: 2.5 (audible modulation)
   - Decay: Much longer (0.9995 instead of 0.99)

2. **Shape Knob Now Works**: The shape knob controls multiple parameters:
   - **Ratio**: 1-8 (lower shape = lower harmonics)
   - **FM Depth**: 1-5 (increases with shape)
   - **Decay Time**: 5s to 0.5s (shorter as shape increases)
   - Turn left for bell-like tones, right for more metallic/percussive sounds

3. **Shift+Shape**: Controls vibrato depth (0-50%)

## How to Use on Minilogue XD

1. Load the fm_bell_v5.mnlgxdunit file onto your Minilogue XD
2. Select the FM Bell oscillator in the USER slot
3. You should immediately hear sound when playing notes
4. Use the **SHAPE** knob to control the bell character:
   - Left (0): Deep bell with long decay
   - Center (512): Balanced bell tone
   - Right (1023): Bright, percussive metallic sound
5. Hold SHIFT and turn SHAPE to add vibrato

## Parameter Menu (SHIFT + DISPLAY)

The oscillator also responds to the parameter menu:
- **Param 1**: Ratio (1-20)
- **Param 2**: FM Depth (0-100%)
- **Param 3**: Decay (0-100%)
- **Param 4**: Mod Decay (0-100%)
- **Param 5**: Fine Ratio (-50% to +50%)
- **Param 6**: Vibrato (0-100%)

## Tips

- The shape knob provides the most immediate control
- For classic bell sounds, keep shape in the lower half
- For steel drum sounds, try middle shape values
- For kalimba/thumb piano, use high shape with short decay
- LFO can modulate the shape parameter for evolving tones