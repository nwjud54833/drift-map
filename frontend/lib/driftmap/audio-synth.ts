/**
 * Zero-dependency Web Audio UI micro-synthesizer.
 *
 * Ported from `DriftAudioSynth` in the Obsidian v2.5 "Spatial" reference build.
 * It is muted by default and only ever creates an AudioContext in response to a
 * user gesture (the header toggle), so it never trips autoplay policies.
 *
 * The module keeps the reference build's singleton shape — including the
 * `DriftAudioSynth` global name — but adds a subscription so React components
 * can render the toggle and equaliser state without polling.
 */
export type DriftSeverity = "breaking" | "warning" | "safe" | "info";

type Listener = (enabled: boolean) => void;

interface DriftAudioSynthApi {
  readonly enabled: boolean;
  toggle(): boolean;
  playTick(freq?: number): void;
  playSafeChime(): void;
  playWarningTone(): void;
  playBreakingPulse(): void;
  playForSeverity(severity: DriftSeverity | string): void;
  subscribe(listener: Listener): () => void;
}

class DriftAudioSynthImpl implements DriftAudioSynthApi {
  private on = false;
  private ctx: AudioContext | null = null;
  private readonly listeners = new Set<Listener>();

  get enabled(): boolean {
    return this.on;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.on);
  }

  private initContext(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggle(): boolean {
    this.on = !this.on;
    if (this.on) {
      this.initContext();
      // Confirmation chime on enabling, matching the reference behaviour.
      this.playTone("triangle", [523.25, 659.25], [0, 0.045], 0.04, 0.18);
    }
    this.emit();
    return this.on;
  }

  /** Subtle high-tech tick on ↑/↓ row navigation and timeline scrubbing. */
  playTick(freq = 1150): void {
    if (!this.on) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.028);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.028);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  /** Soft harmonic chime for Safe / Info findings. */
  playSafeChime(): void {
    if (!this.on) return;
    this.initContext();
    if (!this.ctx) return;
    this.playTone("triangle", [523.25, 659.25], [0, 0.045], 0.04, 0.18);
  }

  /** Warm alert tone on Warning findings. */
  playWarningTone(): void {
    if (!this.on) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392.0, now);
    osc.frequency.setValueAtTime(349.23, now + 0.06);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  /** Deep sub-bass resonant pulse on Breaking drift detection. */
  playBreakingPulse(): void {
    if (!this.on) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.21);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playForSeverity(severity: DriftSeverity | string): void {
    if (!this.on) return;
    this.playTick();
    if (severity === "breaking") this.playBreakingPulse();
    else if (severity === "warning") this.playWarningTone();
    else if (severity === "safe" || severity === "info") this.playSafeChime();
  }

  /** Shared two-stage tone used by the enable chime and the safe chime. */
  private playTone(
    type: OscillatorType,
    frequencies: readonly number[],
    offsets: readonly number[],
    peakGain: number,
    duration: number,
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    frequencies.forEach((frequency, index) => {
      if (!this.ctx) return;
      const offset = offsets[index] ?? 0;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now + offset);

      gain.gain.setValueAtTime(peakGain, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + offset + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + duration + 0.01);
    });
  }
}

export const DriftAudioSynth: DriftAudioSynthApi = new DriftAudioSynthImpl();
