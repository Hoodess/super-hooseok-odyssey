// Sound effects. Each name first tries assets/sfx/<file>; until that file
// exists a small WebAudio synth stands in so every beat still has a sound.

const FILES = {
  hit: 'hit.ogg',
  shutter: 'shutter.ogg',
  card: 'card.ogg',
  tick: 'tick.ogg',
  roulette: 'sfx_roulette.mp3',
  transform: 'sfx_transform.mp3',
  moon: 'sfx_moon.mp3',
  press: 'press.ogg',
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
  }

  // must be called from a user gesture (click / VR enter)
  unlock() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    const base = `${import.meta.env.BASE_URL}sfx/`;
    for (const [name, file] of Object.entries(FILES)) {
      fetch(base + file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((buf) => (this.buffers[name] = buf))
        .catch(() => {});
    }
  }

  play(name) {
    const ctx = this.ctx;
    if (!ctx) return;
    const buf = this.buffers[name];
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.start();
      return;
    }
    const now = ctx.currentTime;
    switch (name) {
      case 'hit': this.noise(now, 0.12, 2400, 0.6); this.tone(now, 180, 60, 0.15, 'sine', 0.8); this.tone(now, 880, 1320, 0.1, 'square', 0.12); break;
      case 'shutter': this.noise(now, 0.05, 6000, 0.6); this.noise(now + 0.07, 0.04, 4000, 0.4); break;
      case 'card': this.noise(now, 0.18, 3000, 0.25); this.tone(now, 660, 990, 0.25, 'triangle', 0.25); break;
      case 'tick': this.tone(now, 1800, 1700, 0.025, 'square', 0.12); break;
      case 'press': this.tone(now, 520, 780, 0.08, 'square', 0.2); break;
      case 'roulette': this.tone(now, 440, 880, 0.3, 'triangle', 0.2); break;
      case 'transform':
        this.noise(now, 0.7, 800, 0.35, 6000);
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(now + 0.08 * i, f, f, 0.35, 'triangle', 0.18));
        break;
      case 'moon':
        [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(now + 0.09 * i, f, f, 0.4, 'square', 0.12));
        this.tone(now + 0.5, 1568, 1568, 0.8, 'triangle', 0.2);
        break;
      case 'start':
        [988, 1319, 1568, 1976, 2637].forEach((f, i) => this.tone(now + 0.06 * i, f, f, 0.16, 'square', 0.14));
        this.tone(now + 0.32, 1976, 1976, 0.5, 'triangle', 0.22);
        break;
      case 'ding': this.tone(now, 1568, 1568, 0.6, 'triangle', 0.3); this.tone(now, 2093, 2093, 0.6, 'sine', 0.2); break;
    }
  }

  tone(t, f0, f1, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, dur, freq, vol, freqEnd) {
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}
