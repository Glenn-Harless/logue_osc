# Kalimba Oscillator - Implementation Plan

This plan captures the design decisions for the kalimba-focused FM oscillator. The tasks below mirror the features implemented in `fm_kalimba.c` and serve as a reference for future tweaks.

## Core Architecture

1. Replace the bell-focused tuning with a curated set of tine ratios taken from acoustic kalimba spectra.
2. Keep the lightweight two-operator FM engine but remove vibrato and fine-ratio controls.
3. Introduce separate exponential decays for amplitude, tine brightness, and attack noise using the existing fast exponential helper.

## Feature Additions

- **Body Resonator**: Add a single-pole follower fed by the excitation signal and expose a Body control that crossfades between direct tine and resonant output while adjusting damping.
- **Attack Noise**: Trigger a short-lived noise envelope on note-on with user-adjustable amount and decay derived from the Noise parameter.
- **Velocity Response**: Scale starting amplitude, modulation emphasis, and noise burst by MIDI velocity to keep expressive dynamics.

## Parameter Mapping

| Parameter | Mapping Strategy |
|-----------|------------------|
| Harmonics | Lookup interpolation across the curated ratio table. |
| Brightness | FM depth range tailored for metallic sparkle with a non-zero floor. |
| Decay | Converts 0–100% into 50 ms – 5 s amplitude decay. |
| Tone Decay | Maps to 10 ms – 1.5 s for the modulation envelope so the tine can darken separately from loudness. |
| Body | Controls both mix amount and damping coefficient of the follower. |
| Noise | Sets the initial noise gain and decays between 3–45 ms. |

## Testing Notes

- Verify stability across the keyboard with Body at extremes to ensure the one-pole follower settles cleanly.
- Sweep Brightness and Tone Decay together to confirm smooth spectral transitions without zippering.
- High-velocity + Noise at 100% should remain below soft-clip thresholds; adjust constants if clipping is heard during evaluation on hardware.
