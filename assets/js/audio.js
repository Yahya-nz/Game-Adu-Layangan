'use strict';
// ================= Suara (disintesis dengan WebAudio, tanpa file) =================

const Sound = {
  ctx: null,
  master: null,
  muted: Store.get('muted', false),
  noiseBuf: null,
  windGain: null, windFilter: null,
  sawGain: null, sawFilter: null,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // buffer derau putih 2 detik
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // angin: derau -> lowpass -> gain
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf; wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 380;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    // gesekan benang: derau -> bandpass -> gain
    const saw = ctx.createBufferSource();
    saw.buffer = this.noiseBuf; saw.loop = true; saw.playbackRate.value = 0.9;
    this.sawFilter = ctx.createBiquadFilter();
    this.sawFilter.type = 'bandpass'; this.sawFilter.frequency.value = 2200; this.sawFilter.Q.value = 4;
    this.sawGain = ctx.createGain(); this.sawGain.gain.value = 0;
    saw.connect(this.sawFilter).connect(this.sawGain).connect(this.master);
    saw.start();
  },

  setMuted(m) {
    this.muted = m;
    Store.set('muted', m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  },

  setWind(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.03 + level * 0.09, t, 0.4);
    this.windFilter.frequency.setTargetAtTime(260 + level * 520, t, 0.4);
  },

  setSaw(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sawGain.gain.setTargetAtTime(Math.min(0.32, level * 0.22), t, 0.03);
    this.sawFilter.frequency.setTargetAtTime(1700 + Math.min(level, 2) * 1300, t, 0.05);
  },

  // ---- efek pendek ----
  _tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  _noise(dur, freq, vol = 0.3, type = 'highpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  },

  snap() { // benang putus
    this._noise(0.12, 3000, 0.5);
    this._tone(1400, 0.18, 'triangle', 0.25, 300);
  },
  hurt() {
    this._tone(160, 0.18, 'square', 0.12, 80);
  },
  catchKite() {
    this._tone(784, 0.12, 'triangle', 0.25);
    this._tone(1175, 0.22, 'triangle', 0.25, null, 0.09);
  },
  combo(n) {
    const f = 520 * Math.pow(1.12, Math.min(n, 12));
    this._tone(f, 0.1, 'square', 0.1);
    this._tone(f * 1.5, 0.16, 'square', 0.08, null, 0.07);
  },
  tok(times = 2) { // bunyi kentongan
    for (let i = 0; i < times; i++) {
      this._tone(620, 0.16, 'triangle', 0.45, 560, i * 0.2);
      this._noise(0.04, 1800, 0.12, 'bandpass', i * 0.2);
    }
  },
  warn() {
    this._tone(330, 0.09, 'sine', 0.12);
  },
  gameOver() {
    [523, 440, 349, 262].forEach((f, i) => this._tone(f, 0.32, 'triangle', 0.25, null, i * 0.18));
  },
  click() {
    this._tone(900, 0.05, 'square', 0.06);
  },
};
