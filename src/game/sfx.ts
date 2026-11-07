export class Sfx {
  muted: boolean;
  private ctx: AudioContext | null = null;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  jump(): void {
    this.tone(420, 0.09, "square", 0.045, 700);
  }

  duck(): void {
    this.tone(170, 0.07, "sine", 0.04, 90);
  }

  die(): void {
    this.tone(260, 0.28, "sawtooth", 0.05, 48);
  }

  mark(): void {
    this.tone(523, 0.08, "square", 0.03);
    window.setTimeout(() => this.tone(659, 0.08, "square", 0.03), 90);
    window.setTimeout(() => this.tone(784, 0.12, "square", 0.03), 170);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    toFreq?: number,
  ): void {
    if (this.muted || !this.ctx) return;
    const audio = this.ctx;
    const start = audio.currentTime;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (toFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), start + dur);
    }
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}
