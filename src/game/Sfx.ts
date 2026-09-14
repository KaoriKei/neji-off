// 合成効果音（Web Audio）。音声ファイルは使わない（仮実装）。

export class Sfx {
  private ctx: AudioContext | null = null;

  /** ユーザー操作（タップ）の中で呼ぶ。iOS はこれが無いと音が出ない */
  unlock(): void {
    const ac = this.ac();
    if (ac && ac.state === 'suspended') void ac.resume();
  }

  private ac(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(opts: { type: OscillatorType; f0: number; f1?: number; dur: number; gain: number; delay?: number }): void {
    const ac = this.ac();
    if (!ac) return;
    const t0 = ac.currentTime + (opts.delay ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(opts.f1, t0 + opts.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  private noise(dur: number, gain: number, delay = 0): void {
    const ac = this.ac();
    if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = gain;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    src.connect(lp).connect(g).connect(ac.destination);
    src.start(ac.currentTime + delay);
  }

  /** カチッ（ネジが穴にはまる） */
  click(): void {
    this.tone({ type: 'square', f0: 1800, f1: 900, dur: 0.045, gain: 0.08 });
    this.noise(0.03, 0.06);
  }

  /** コツ（覆われていて抜けない） */
  knock(): void {
    this.tone({ type: 'sine', f0: 140, f1: 70, dur: 0.09, gain: 0.3 });
  }

  /** ブッ（仮置き場が満杯） */
  buzz(): void {
    this.tone({ type: 'sawtooth', f0: 110, f1: 90, dur: 0.14, gain: 0.12 });
  }

  /** ポン（トレイ満杯） */
  pop(): void {
    this.tone({ type: 'sine', f0: 420, f1: 900, dur: 0.12, gain: 0.18 });
  }

  /** ガタン（板が外れる） */
  clunk(): void {
    this.noise(0.08, 0.22);
    this.tone({ type: 'sine', f0: 70, f1: 45, dur: 0.2, gain: 0.3 });
  }
}
