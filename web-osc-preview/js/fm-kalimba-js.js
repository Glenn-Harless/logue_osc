const SAMPLE_RATE = 48000;

const MIN_DECAY_TIME = 0.05;
const MAX_DECAY_TIME = 5.0;
const MIN_TONE_DECAY = 0.01;
const MAX_TONE_DECAY = 1.5;
const MIN_NOISE_TIME = 0.003;
const MAX_NOISE_TIME = 0.045;

const TINE_RATIOS = [
  1.5, 1.7, 1.9, 2.15, 2.4,
  2.7, 3.1, 3.5, 4.0, 4.6, 5.2
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateTineRatio(norm) {
  const last = TINE_RATIOS.length - 1;
  const scaled = norm * last;
  const index = Math.min(Math.floor(scaled), last - 1);
  const frac = scaled - index;
  return lerp(TINE_RATIOS[index], TINE_RATIOS[index + 1], frac);
}

export class FMKalimbaOscillator {
  constructor() {
    this.sampleRate = SAMPLE_RATE;

    this.carrierPhase = 0;
    this.modPhase = 0;
    this.ratio = TINE_RATIOS[0];
    this.fmDepth = 0.8;

    this.ampEnv = 0;
    this.modEnv = 0;
    this.noiseEnv = 0;

    this.ampDecay = Math.exp(-1 / (MIN_DECAY_TIME * SAMPLE_RATE));
    this.modDecay = Math.exp(-1 / (MIN_TONE_DECAY * SAMPLE_RATE));
    this.noiseDecay = Math.exp(-1 / (MIN_NOISE_TIME * SAMPLE_RATE));

    this.bodyState = 0;
    this.bodyMix = 0;
    this.bodyCoeff = 0.1;
    this.noiseAmount = 0;

    this.currentNote = 60;
    this.paramValues = new Map();
  }

  setParam(index, value) {
    this.paramValues.set(index, value);

    const norm = value / 1023;

    switch (index) {
      case 0: // Tine
        this.ratio = interpolateTineRatio(norm);
        break;
      case 1: // Brightness
        this.fmDepth = 0.8 + norm * 10.8;
        break;
      case 2: { // Decay
        const decayTime = MIN_DECAY_TIME + norm * (MAX_DECAY_TIME - MIN_DECAY_TIME);
        this.ampDecay = Math.exp(-1 / (decayTime * SAMPLE_RATE));
        break;
      }
      case 3: { // Tone decay
        const decayTime = MIN_TONE_DECAY + norm * (MAX_TONE_DECAY - MIN_TONE_DECAY);
        this.modDecay = Math.exp(-1 / (decayTime * SAMPLE_RATE));
        break;
      }
      case 4: // Body mix / damping
        this.bodyMix = norm;
        this.bodyCoeff = 0.02 + (1 - norm) * 0.08;
        break;
      case 5: { // Noise
        this.noiseAmount = norm;
        const noiseTime = MIN_NOISE_TIME + norm * (MAX_NOISE_TIME - MIN_NOISE_TIME);
        this.noiseDecay = Math.exp(-1 / (noiseTime * SAMPLE_RATE));
        break;
      }
      default:
        break;
    }
  }

  setShape(value) {
    this.setParam(0, value);
  }

  applyStoredParams() {
    for (const [index, value] of this.paramValues.entries()) {
      this.setParam(index, value);
    }
  }

  noteOn(note, velocity = 100) {
    const velNorm = Math.max(0, Math.min(velocity / 127, 1));
    const ampScale = 0.55 + 0.45 * velNorm;
    const brightScale = 1.0 + 0.4 * velNorm;

    this.currentNote = note;
    this.ampEnv = ampScale;
    this.modEnv = brightScale;
    this.noiseEnv = this.noiseAmount * (0.4 + 0.6 * velNorm);

    this.carrierPhase = 0;
    this.modPhase = 0;
    this.bodyState = 0;

    this.applyStoredParams();
  }

  noteOff() {
    // Passive release handled by decay factors
  }

  process(outputArray, frames) {
    const frequency = 440 * Math.pow(2, (this.currentNote - 69) / 12);
    const carrierInc = (2 * Math.PI * frequency) / this.sampleRate;
    const modInc = carrierInc * this.ratio;

    for (let i = 0; i < frames; i++) {
      this.ampEnv *= this.ampDecay;
      this.modEnv *= this.modDecay;
      this.noiseEnv *= this.noiseDecay;

      const modSig = Math.sin(this.modPhase) * (this.fmDepth * this.modEnv);
      const excitation = Math.sin(this.carrierPhase + modSig);

      this.bodyState += this.bodyCoeff * (excitation - this.bodyState);
      const tone = excitation + this.bodyMix * (this.bodyState - excitation);

      let output = tone * this.ampEnv;
      if (this.noiseEnv > 0.0001) {
        output += (Math.random() * 2 - 1) * this.noiseEnv * 0.35;
      }

      outputArray[i] = Math.tanh(output * 1.5);

      this.carrierPhase += carrierInc;
      this.modPhase += modInc;

      if (this.carrierPhase > Math.PI * 2) {
        this.carrierPhase -= Math.PI * 2;
      }
      if (this.modPhase > Math.PI * 2) {
        this.modPhase -= Math.PI * 2;
      }
    }
  }
}
