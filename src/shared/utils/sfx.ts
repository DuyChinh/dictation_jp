/**
 * Lightweight, zero-asset Web Audio API sound effects synthesizer
 * Generates sparkling victory chimes, streak chords, and encouragement tones.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Cheerful sparkling chime progression (C5 -> E5 -> G5 -> C6) */
  playVictory() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.001, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  }

  /** Resonating chord on streak / combo */
  playStreak(streakCount = 3) {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const base = 440 * Math.pow(1.05946, Math.min(streakCount, 8)); // scale up with streak
    const freqs = [base, base * 1.25, base * 1.5, base * 2];
    const now = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  /** Soft encouragement tone for retries */
  playEncourage() {
    if (!this.enabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37]; // A4, C#5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0.001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.35);
    });
  }
}

export const sfx = new SoundEffects();
