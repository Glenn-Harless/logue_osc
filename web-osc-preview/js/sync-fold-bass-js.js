const SAMPLE_RATE = 48000;

const DEFAULT_SYNC_NORM = 0.55;
const DEFAULT_FOLD_NORM = 0.6;
const DEFAULT_TILT_NORM = 0.5;
const DEFAULT_SUB_NORM = 0.55;
const DEFAULT_DRIVE_NORM = 0.45;
const DEFAULT_PUNCH_NORM = 0.55;

const MIN_PUNCH_TIME = 0.01;
const MAX_PUNCH_TIME = 0.18;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function wrap01(value) {
  return value - Math.floor(value);
}

function foldOnce(x) {
  if (x > 1) {
    return 2 - x;
  }
  if (x < -1) {
    return -2 - x;
  }
  return x;
}

function wavefold(x, amount) {
  const drive = 1 + amount * 4.5;
  let y = x * drive;
  y = foldOnce(y);
  y = foldOnce(y);
  y = foldOnce(y);
  return y;
}

function calcSyncRatio(norm) {
  const shaped = norm * norm;
  return 1 + shaped * 5.5;
}

function calcSyncBlend(norm) {
  return 0.35 + norm * 0.55;
}

function calcDriveBoost(norm) {
  return 0.9 + norm * 2.6;
}

function calcPunchDecay(norm) {
  const time = MIN_PUNCH_TIME + norm * (MAX_PUNCH_TIME - MIN_PUNCH_TIME);
  return Math.exp(-1 / (time * SAMPLE_RATE));
}

function midiNoteToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class SyncFoldBassOscillator {
  constructor() {
    this.sampleRate = SAMPLE_RATE;

    this.masterPhase = 0;
    this.slavePhase = 0;
    this.subPhase = 0;

    this.syncRatio = calcSyncRatio(DEFAULT_SYNC_NORM);
    this.syncBlend = calcSyncBlend(DEFAULT_SYNC_NORM);
    this.foldAmount = DEFAULT_FOLD_NORM;
    this.tiltMix = DEFAULT_TILT_NORM;
    this.subMix = DEFAULT_SUB_NORM;
    this.driveBoost = calcDriveBoost(DEFAULT_DRIVE_NORM);

    this.punchAmount = DEFAULT_PUNCH_NORM;
    this.punchEnv = 0;
    this.punchDecay = calcPunchDecay(DEFAULT_PUNCH_NORM);

    this.baseGain = 0.55;
    this.frequency = midiNoteToFrequency(36);
    this.currentNote = 36;

    this.paramValues = new Map();
  }

  setParam(index, value) {
    this.paramValues.set(index, value);
    const norm = clamp01(value / 1023);

    switch (index) {
      case 0: // Sync
        this.syncRatio = calcSyncRatio(norm);
        this.syncBlend = calcSyncBlend(norm);
        break;
      case 1: // Fold
        this.foldAmount = norm;
        break;
      case 2: // Tilt
        this.tiltMix = clamp01(norm);
        break;
      case 3: // Sub Mix
        this.subMix = clamp01(norm);
        break;
      case 4: // Drive
        this.driveBoost = calcDriveBoost(norm);
        break;
      case 5: // Punch
        this.punchAmount = clamp01(norm);
        this.punchDecay = calcPunchDecay(norm);
        break;
      default:
        break;
    }
  }

  setShape(value) {
    this.setParam(0, value);
  }

  setShiftShape(value) {
    this.setParam(5, value);
  }

  applyStoredParams() {
    for (const [index, value] of this.paramValues.entries()) {
      this.setParam(index, value);
    }
  }

  noteOn(note, velocity = 100) {
    this.currentNote = note;
    this.frequency = midiNoteToFrequency(note);

    this.masterPhase = 0;
    this.slavePhase = 0;
    this.subPhase = 0;
    this.punchEnv = 1;

    this.applyStoredParams();
  }

  noteOff() {
    // Passive release handled by punch envelope decay.
  }

  process(outputArray, frames) {
    const baseInc = this.frequency / this.sampleRate;
    const slaveInc = baseInc * this.syncRatio;
    const subInc = baseInc * 0.5;

    let master = this.masterPhase;
    let slave = this.slavePhase;
    let sub = this.subPhase;
    let punch = this.punchEnv;

    for (let i = 0; i < frames; i++) {
      master += baseInc;
      let reset = false;
      if (master >= 1) {
        master -= 1;
        reset = true;
      }

      slave += slaveInc;
      if (reset) {
        slave = slaveInc;
      }
      slave = wrap01(slave);

      sub += subInc;
      sub = wrap01(sub);

      const saw = (slave * 2) - 1;

      const transient = punch * this.punchAmount;
      const foldDepth = Math.min(this.foldAmount + transient * 0.8, 1.2);
      const folded = wavefold(saw, foldDepth);

      let evenPhase = slave * 2;
      evenPhase -= Math.floor(evenPhase);
      const evenWave = (evenPhase * 2) - 1;

      const tone = folded * (1 - this.tiltMix) + evenWave * this.tiltMix;
      const core = tone * this.syncBlend + saw * (1 - this.syncBlend);

      const subWave = Math.sin(sub * Math.PI * 2) * 0.8;
      const combined = core * (1 - this.subMix) + subWave * this.subMix;

      const drive = Math.min(this.driveBoost + transient * 1.4, 4.0);
      const sample = Math.tanh(combined * this.baseGain * drive * 1.2);

      outputArray[i] = sample;

      punch *= this.punchDecay;
    }

    this.masterPhase = master;
    this.slavePhase = slave;
    this.subPhase = sub;
    this.punchEnv = punch;
  }
}
