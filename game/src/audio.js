// All sound is synthesized with WebAudio: no audio files, no network.
// Every call is guarded, so the game plays fine when audio is unavailable
// (headless browsers, muted tabs) and never throws.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  /** Create the context lazily, on the first user gesture or first sound. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** A short oscillator blip with a pitch slide. */
  blip({ type = 'square', from = 440, to = 220, dur = 0.08, vol = 0.2, when = 0 } = {}) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  /** A burst of filtered noise, for explosions and hits. */
  noise({ dur = 0.25, vol = 0.3, freq = 1200, when = 0 } = {}) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    try {
      const t0 = ctx.currentTime + when;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, t0);
      filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  shoot() { this.blip({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.12 }); }
  enemyHit() { this.blip({ type: 'triangle', from: 300, to: 180, dur: 0.05, vol: 0.1 }); }
  explode(big = false) {
    this.noise({ dur: big ? 0.5 : 0.25, vol: big ? 0.4 : 0.25, freq: big ? 900 : 1600 });
    this.blip({ type: 'sine', from: big ? 160 : 220, to: 40, dur: big ? 0.5 : 0.3, vol: 0.3 });
  }
  playerHit() {
    this.blip({ type: 'sawtooth', from: 200, to: 60, dur: 0.3, vol: 0.3 });
    this.noise({ dur: 0.2, vol: 0.2, freq: 800 });
  }
  dash() { this.noise({ dur: 0.14, vol: 0.14, freq: 3200 }); }
  upgrade() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip({ type: 'triangle', from: f, to: f, dur: 0.12, vol: 0.16, when: i * 0.07 }));
  }
  horn() {
    this.blip({ type: 'sawtooth', from: 110, to: 220, dur: 0.5, vol: 0.18 });
    this.blip({ type: 'sawtooth', from: 165, to: 330, dur: 0.5, vol: 0.1, when: 0.05 });
  }
  bossAlarm() {
    [0, 0.22].forEach((w) => {
      this.blip({ type: 'square', from: 440, to: 440, dur: 0.16, vol: 0.14, when: w });
      this.blip({ type: 'square', from: 311, to: 311, dur: 0.16, vol: 0.14, when: w + 0.11 });
    });
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.blip({ type: 'triangle', from: f, to: f * 0.94, dur: 0.22, vol: 0.18, when: i * 0.16 }));
  }

  /** A quiet bass pulse that keeps time under the action. Call every frame. */
  updateMusic(dt, playing) {
    if (this.muted || !playing) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24;
    const roots = [55, 55, 65.41, 49];
    const root = roots[this.musicStep % roots.length];
    this.musicStep += 1;
    this.blip({ type: 'triangle', from: root, to: root, dur: 0.22, vol: 0.09 });
    if (this.musicStep % 4 === 0) this.blip({ type: 'sine', from: root * 2, to: root * 2, dur: 0.1, vol: 0.05 });
  }
}
