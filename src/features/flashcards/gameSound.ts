import { musicOn, soundOn, SOUND_EVENT } from "./prefs";

/**
 * Sounds of the quiz show and the gold miner, made on the spot with the Web Audio API (no sound files): brass
 * stabs and fanfares, a low pulse that tightens as the clock runs down, a ring, a buzzer, a cash register. They
 * follow the usual language of such shows without copying any recording. Everything is silent while the learner
 * has sound switched off, and the background pulse also needs music on.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: master! };
}

type Tone = {
  at?: number;
  freq: number;
  /** Slides to this frequency by the end. */
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  /** Seconds to reach full volume. */
  attack?: number;
  /** A low-pass filter that opens on the note, which is what makes a sawtooth sound like brass. */
  brass?: boolean;
};

function tone(c: AudioContext, out: AudioNode, t0: number, o: Tone): void {
  const t = t0 + (o.at ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const vol = o.vol ?? 0.15;
  const attack = o.attack ?? 0.015;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  if (o.brass) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(o.freq * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(8000, o.freq * 7), t + Math.min(0.12, o.dur / 2));
    lp.frequency.exponentialRampToValueAtTime(o.freq * 2.5, t + o.dur);
    osc.connect(lp);
    lp.connect(gain);
  } else osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

type Noise = { at?: number; dur: number; vol?: number; freq: number; to?: number; q?: number; type?: BiquadFilterType };

function noise(c: AudioContext, out: AudioNode, t0: number, o: Noise): void {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = t0 + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const gain = c.createGain();
  const vol = o.vol ?? 0.2;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, o.dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + o.dur + 0.05);
}

const hz = (semitonesFromC4: number) => 261.63 * Math.pow(2, semitonesFromC4 / 12);

/** A major chord of brass notes, root `base` (semitones above middle C), held for `dur`. */
function chord(c: AudioContext, out: AudioNode, t0: number, base: number, dur: number, vol = 0.07, at = 0) {
  for (const step of [0, 4, 7, 12]) tone(c, out, t0, { at, freq: hz(base + step), dur, type: "sawtooth", vol, attack: 0.03, brass: true });
}

export type ShowSound =
  | "question"
  | "lock"
  | "correct"
  | "wrong"
  | "milestone"
  | "win"
  | "walk"
  | "timeup"
  | "tick"
  | "fifty"
  | "audience"
  | "phone"
  | "swap"
  | "launch"
  | "grab"
  | "boom"
  | "levelClear";

const PLAYERS: Record<ShowSound, (c: AudioContext, out: AudioNode, t: number) => void> = {
  // a new question appears: a low swell and a soft hit
  question(c, out, t) {
    tone(c, out, t, { freq: 98, to: 196, dur: 0.55, type: "sawtooth", vol: 0.06, attack: 0.3, brass: true });
    tone(c, out, t, { at: 0.5, freq: 392, dur: 0.18, type: "triangle", vol: 0.09 });
  },
  // "final answer": a heavy beat, then a held tension note
  lock(c, out, t) {
    tone(c, out, t, { freq: 110, to: 38, dur: 0.45, type: "sine", vol: 0.34 });
    noise(c, out, t, { dur: 0.1, freq: 1200, vol: 0.06 });
    tone(c, out, t, { at: 0.12, freq: hz(-5), dur: 0.7, type: "sawtooth", vol: 0.05, attack: 0.25, brass: true });
  },
  correct(c, out, t) {
    [0, 4, 7].forEach((s, i) => tone(c, out, t, { at: i * 0.07, freq: hz(s), dur: 0.2, type: "sawtooth", vol: 0.09, brass: true }));
    chord(c, out, t, 0, 0.9, 0.065, 0.21);
    tone(c, out, t, { at: 0.24, freq: hz(24), dur: 0.5, type: "sine", vol: 0.06 });
  },
  wrong(c, out, t) {
    tone(c, out, t, { freq: 233, to: 110, dur: 0.85, type: "sawtooth", vol: 0.12, attack: 0.04, brass: true });
    tone(c, out, t, { freq: 165, to: 78, dur: 0.95, type: "sawtooth", vol: 0.1, attack: 0.04, brass: true });
    tone(c, out, t, { at: 0.02, freq: 55, to: 40, dur: 0.9, type: "sine", vol: 0.28 });
  },
  // a safe level reached: a longer, grander fanfare with sparkles
  milestone(c, out, t) {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(c, out, t, { at: i * 0.085, freq: hz(s), dur: 0.22, type: "sawtooth", vol: 0.085, brass: true }));
    chord(c, out, t, 7, 1.6, 0.06, 0.6);
    chord(c, out, t, 0, 1.6, 0.06, 0.6);
    [88, 91, 95, 100].forEach((s, i) => tone(c, out, t, { at: 0.7 + i * 0.11, freq: hz(s - 60), dur: 0.5, type: "sine", vol: 0.05 }));
    tone(c, out, t, { at: 0.6, freq: 65, dur: 1.2, type: "sine", vol: 0.18 });
  },
  win(c, out, t) {
    PLAYERS.milestone(c, out, t);
    PLAYERS.milestone(c, out, t + 1.35);
    [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => tone(c, out, t, { at: 2.7 + i * 0.07, freq: hz(s + 12), dur: 0.5, type: "triangle", vol: 0.07 }));
    chord(c, out, t, 5, 2.2, 0.07, 3.3);
    chord(c, out, t, 0, 2.2, 0.07, 3.3);
  },
  // walking away: a cash register
  walk(c, out, t) {
    noise(c, out, t, { dur: 0.09, freq: 4000, vol: 0.12 });
    tone(c, out, t, { at: 0.08, freq: 1318.5, dur: 0.5, type: "sine", vol: 0.13 });
    tone(c, out, t, { at: 0.2, freq: 1760, dur: 0.7, type: "sine", vol: 0.12 });
    [0.34, 0.4, 0.46, 0.52].forEach((a, i) => noise(c, out, t, { at: a, dur: 0.05, freq: 5200 + i * 300, vol: 0.06 }));
  },
  timeup(c, out, t) {
    tone(c, out, t, { freq: 98, dur: 1.1, type: "sawtooth", vol: 0.16, attack: 0.02 });
    tone(c, out, t, { freq: 103, dur: 1.1, type: "square", vol: 0.07, attack: 0.02 });
  },
  tick(c, out, t) {
    tone(c, out, t, { freq: 1500, dur: 0.05, type: "square", vol: 0.04 });
  },
  fifty(c, out, t) {
    [0, 0.17].forEach((a) => tone(c, out, t, { at: a, freq: 900, to: 300, dur: 0.14, type: "triangle", vol: 0.16 }));
    tone(c, out, t, { at: 0.34, freq: 1200, dur: 0.18, type: "sine", vol: 0.07 });
  },
  // applause: noise that swells and fades, with a murmur under it
  audience(c, out, t) {
    noise(c, out, t, { dur: 1.7, freq: 1800, q: 0.7, vol: 0.2 });
    noise(c, out, t, { at: 0.1, dur: 1.5, freq: 3200, q: 0.5, vol: 0.09 });
    noise(c, out, t, { dur: 1.7, freq: 500, q: 0.6, vol: 0.1 });
  },
  // an old telephone: two rings
  phone(c, out, t) {
    [0, 0.75].forEach((a) => {
      for (let i = 0; i < 6; i++) {
        tone(c, out, t, { at: a + i * 0.065, freq: i % 2 ? 480 : 440, dur: 0.06, type: "square", vol: 0.05 });
      }
    });
  },
  swap(c, out, t) {
    noise(c, out, t, { dur: 0.45, freq: 350, to: 3000, q: 1.2, vol: 0.2 });
    tone(c, out, t, { at: 0.38, freq: 660, dur: 0.12, type: "triangle", vol: 0.1 });
  },
  // gold miner: the claw is launched, catches something, blows something up, a level is cleared
  launch(c, out, t) {
    noise(c, out, t, { dur: 0.3, freq: 2400, to: 500, q: 1.1, vol: 0.12 });
    tone(c, out, t, { freq: 420, to: 180, dur: 0.22, type: "triangle", vol: 0.07 });
  },
  grab(c, out, t) {
    tone(c, out, t, { freq: 220, to: 150, dur: 0.12, type: "square", vol: 0.09 });
    noise(c, out, t, { dur: 0.08, freq: 3000, q: 2, vol: 0.12 });
    tone(c, out, t, { at: 0.06, freq: 1568, dur: 0.3, type: "sine", vol: 0.07 });
  },
  boom(c, out, t) {
    noise(c, out, t, { dur: 0.7, freq: 900, to: 90, type: "lowpass", q: 0.8, vol: 0.4 });
    tone(c, out, t, { freq: 130, to: 28, dur: 0.7, type: "sine", vol: 0.4 });
  },
  levelClear(c, out, t) {
    [0, 4, 7, 12].forEach((s, i) => tone(c, out, t, { at: i * 0.09, freq: hz(s), dur: 0.2, type: "sawtooth", vol: 0.08, brass: true }));
    chord(c, out, t, 0, 1.0, 0.065, 0.36);
    [84, 88, 91].forEach((s, i) => tone(c, out, t, { at: 0.5 + i * 0.1, freq: hz(s - 60), dur: 0.4, type: "sine", vol: 0.05 }));
  },
};

/** Plays one sound, unless sound is switched off. */
export function playGameSound(name: ShowSound): void {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  PLAYERS[name](a.c, a.out, a.c.currentTime + 0.01);
}

// ---------- background pulse ----------

type Bed = { gain: GainNode; stop: () => void };
let bed: Bed | null = null;
/** What the screen asked for, so the pulse can come back when music is switched on in the middle of a question. */
let wanted: { level: number; urgent: boolean } | null = null;

const allowed = () => soundOn() && musicOn();

function buildBed(level: number, urgent: boolean): Bed | null {
  const a = audio();
  if (!a) return null;
  const { c, out } = a;
  const base = 55 * Math.pow(2, (level - 1) / 26);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.6);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  lp.connect(gain);
  gain.connect(out);

  const oscs = [c.createOscillator(), c.createOscillator(), c.createOscillator()];
  oscs[0]!.type = "sine";
  oscs[0]!.frequency.value = base;
  oscs[1]!.type = "triangle";
  oscs[1]!.frequency.value = base * 1.498; // a fifth up
  oscs[2]!.type = "sawtooth";
  oscs[2]!.frequency.value = base * 2.003;
  const mix = oscs.map((o, i) => {
    const g = c.createGain();
    g.gain.value = [0.9, 0.5, 0.12][i]!;
    o.connect(g);
    g.connect(lp);
    o.start();
    return g;
  });
  // the drone breathes
  const lfo = c.createOscillator();
  const depth = c.createGain();
  lfo.frequency.value = 0.35;
  depth.gain.value = 0.25;
  lfo.connect(depth);
  depth.connect(mix[1]!.gain);
  lfo.start();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let tight = urgent;
  const beat = () => {
    if (!allowed()) return;
    tone(c, out, c.currentTime + 0.01, { freq: base * 1.5, to: base * 0.7, dur: 0.2, type: "sine", vol: 0.17 });
    if (tight) tone(c, out, c.currentTime + 0.14, { freq: base * 1.5, to: base * 0.7, dur: 0.16, type: "sine", vol: 0.12 });
    timer = setTimeout(beat, tight ? 520 : 940);
  };
  beat();
  (gain as GainNode & { tighten?: (on: boolean) => void }).tighten = (on) => {
    tight = on;
  };

  return {
    gain,
    stop: () => {
      clearTimeout(timer);
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      [...oscs, lfo].forEach((o) => {
        try {
          o.stop(t + 0.22);
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

function syncBed(): void {
  if (wanted && allowed()) {
    if (!bed) bed = buildBed(wanted.level, wanted.urgent);
    else (bed.gain as GainNode & { tighten?: (on: boolean) => void }).tighten?.(wanted.urgent);
  } else if (bed) {
    bed.stop();
    bed = null;
  }
}

/** Starts the tense background pulse for a question; `level` (1-15) lifts its pitch a little each question. */
export function startBed(level: number, urgent = false): void {
  stopBed();
  wanted = { level, urgent };
  syncBed();
}

/** Tightens the pulse, e.g. when the clock is nearly out. */
export function tightenBed(urgent: boolean): void {
  if (!wanted || wanted.urgent === urgent) return;
  wanted = { ...wanted, urgent };
  syncBed();
}

export function stopBed(): void {
  wanted = null;
  syncBed();
}

// switching sound or music off silences the pulse at once, and on brings it back
if (typeof window !== "undefined") window.addEventListener(SOUND_EVENT, syncBed);
