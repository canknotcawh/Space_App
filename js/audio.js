/* =============================================================================
 * audio.js — Web Audio sonification engine (không dùng file âm thanh)
 *
 *  Track A (terrain):  cao độ ← độ cao TB/đỉnh; nhịp ← độ gồ ghề;
 *                      lớp nền ← rừng / biển / sông hồ / cát / gió núi.
 *  Track B (climate):  hợp âm & bộ lọc ← nhiệt độ; gió ← tốc độ gió;
 *                      mưa ← lượng mưa; nền ambient ← độ ẩm & mây.
 *
 *  Mỗi track là một "bản nhạc" 60s lặp lại, có transport riêng
 *  (play/pause/stop/seek ±10s/restart), gain riêng và AnalyserNode riêng.
 * ========================================================================== */

const DURATION = 60;

/* ----------------------------- helpers ---------------------------------- */
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function makeNoiseBuffer(ctx, seconds = 4) {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(2, rate * seconds, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      // Lọc hồng nhẹ cho tự nhiên hơn white noise
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
  }
  return buf;
}

/* ----------------------------- Sonifier --------------------------------- */
export class Sonifier {
  constructor(kind) {
    this.kind = kind;                 // 'terrain' | 'climate'
    this.duration = DURATION;
    this.profile = null;
    this.position = 0;                // giây, dùng khi paused
    this.playing = false;
    this.volume = kind === 'terrain' ? 0.75 : 0.7;
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.gain = null;
    this.analyser = null;
    this.ambient = [];
    this.events = [];
    this._idx = 0;
    this._startedAt = 0;
    this._timer = 0;
    this._noise = null;
    this._onEnded = null;
    this._rainAt = 0;
    this._dropletNext = 0;
    this.spatial = false;
    this.spatialAngle = 0;
    this.tempo = 1;
    this._seedKey = 'earth';
  }

  /** Nhịp nhanh/chậm (0.6–1.6), giữ nguyên vị trí phát. */
  setTempo(v) {
    const next = Math.min(1.6, Math.max(0.6, Number(v) || 1));
    if (Math.abs(next - this.tempo) < 0.001) return;
    this.tempo = next;
    if (this.profile) this.reload(this.profile, this._seedKey);
  }

  /** Bật/tắt đặt nguồn âm thanh theo hướng địa điểm (HRTF). */
  setSpatial(on) {
    this.spatial = !!on;
  }

  /** Góc lệch (độ) giữa hướng nhìn của camera và kinh độ địa điểm. */
  setSpatialAngle(deg) {
    this.spatialAngle = Number(deg) || 0;
  }

  /** Gắn vào AudioContext + master gain (gọi một lần). */
  attach(ctx, master, noiseBuffer) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = master;
    this._noise = noiseBuffer;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.effectiveGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gain.connect(this.analyser);
    this.analyser.connect(master);
  }

  effectiveGain() { return this.muted ? 0 : this.volume * this.volume; }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.effectiveGain(), now, 0.03);
    }
  }

  setMuted(m) {
    this.muted = !!m;
    this.setVolume(this.volume);
  }

  /** Chuyển mức âm lượng mượt trong `seconds` giây (dùng cho crossfade A/B). */
  fadeTo(v, seconds = 2) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.effectiveGain(), now, Math.max(0.08, seconds / 3));
    }
  }

  /** Nạp dữ liệu quốc gia → dựng danh sách nốt + thông số môi trường. */
  load(profile, seedKey = 'earth') {
    this.stop();
    this.profile = profile;
    this._seedKey = seedKey;
    this.events = this._buildEvents(seedKey);
    this.position = 0;
    this._idx = 0;
  }

  /** Đổi profile nhưng giữ nguyên vị trí và trạng thái phát (dùng khi đổi mùa). */
  reload(profile, seedKey = 'earth') {
    const wasPlaying = this.playing;
    const pos = this.getPosition();
    this.stop();
    this.profile = profile;
    this._seedKey = seedKey;
    this.events = this._buildEvents(seedKey);
    this.position = Math.min(pos, this.duration - 0.05);
    this._reindex();
    if (wasPlaying) this.play();
  }

  _buildEvents(seedKey) {
    const p = this.profile;
    if (!p) return [];
    const rand = mulberry32(hashString(`${seedKey}:${p.kind}`));
    const events = [];
    if (p.kind === 'terrain') {
      const scale = p.scale || [0, 3, 5, 7, 10];
      const spacing = 1 / Math.max(0.35, p.density * 1.5);
      let step = 0;
      for (let t = 0.25; t < this.duration; t += (spacing * (0.55 + rand() * 1.1)) / this.tempo) {
        step = Math.max(-2, Math.min(5, step + (rand() < 0.42 ? -1 : 1)));
        const octave = 12 * (rand() < 0.24 ? 1 : 0);
        const note = scale[((step % scale.length) + scale.length) % scale.length];
        events.push({
          t,
          freq: midiToFreq(p.rootMidi + note + octave),
          dur: 0.5 + rand() * 1.2,
          gain: 0.055 + rand() * 0.06,
          pan: (rand() * 2 - 1) * 0.6,
          type: 'pluck'
        });
      }
    } else {
      const density = p.bellDensity || 0.5;
      for (let t = 0.6; t < this.duration; t += ((0.9 + rand() * 2.2) / density) / this.tempo) {
        const chord = p.chord || [0, 3, 7, 10];
        const note = chord[Math.floor(rand() * chord.length)] + 12 * (rand() < 0.3 ? 1 : 0);
        events.push({
          t,
          freq: midiToFreq(p.rootMidi + note + 12),
          dur: 1.4 + rand() * 2.2,
          gain: 0.035 + rand() * 0.045,
          pan: (rand() * 2 - 1) * 0.7,
          type: 'bell'
        });
      }
    }
    if (Array.isArray(p.hazards) && p.hazards.length) {
      p.hazards.forEach((h) => events.push({
        t: h.t,
        freq: h.kind === 'quake' ? 48 : 210,
        dur: h.kind === 'quake' ? 1.6 : 0.9,
        gain: h.gain || 0.12,
        pan: (Math.random() * 2 - 1) * 0.4,
        type: 'hazard',
        kind: h.kind
      }));
      events.sort((a, b) => a.t - b.t);
    }
    return events;
  }

  /* ---------------------------- ambient beds ---------------------------- */
  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    src.start();
    this.ambient.push(src);
    return src;
  }

  _bed({ src, filter, filterType = 'lowpass', freq = 800, q = 0.8, gain = 0.1, lfoRate = 0, lfoDepth = 0, pan = 0 }) {
    const ctx = this.ctx;
    const node = ctx.createBufferSource();
    node.buffer = this._noise;
    node.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = pan;
    node.connect(f);
    f.connect(g);
    if (panner) { g.connect(panner); panner.connect(this.gain); } else { g.connect(this.gain); }
    node.start();
    // fade-in nhẹ để tránh click
    g.gain.setTargetAtTime(gain, ctx.currentTime, 0.8);
    if (lfoRate && ctx.createOscillator) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value = lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start();
      this.ambient.push(lfo);
    }
    this.ambient.push(node, f, g);
    if (panner) this.ambient.push(panner);
    return { src: node, gainNode: g, filter: f };
  }

  _buildAmbient() {
    if (!this.ctx || !this.profile) return;
    this._killAmbient();
    const p = this.profile;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    if (p.kind === 'terrain') {
      const a = p.ambience || {};
      // Gió vùng cao
      this._bed({ freq: 780, filterType: 'bandpass', q: 0.7, gain: 0.16 * (a.wind ?? 0.2), lfoRate: 0.07, lfoDepth: 0.05, pan: -0.2 });
      // Sóng biển / sông hồ
      this._bed({ freq: 380, filterType: 'lowpass', q: 0.6, gain: 0.22 * (a.water ?? 0.1), lfoRate: 0.09, lfoDepth: 0.09, pan: 0.25 });
      // Rừng lá xào xạc
      this._bed({ freq: 3100, filterType: 'bandpass', q: 1.1, gain: 0.13 * (a.forest ?? 0.1), lfoRate: 3.1, lfoDepth: 0.03, pan: 0.35 });
      // Cát / sa mạc
      this._bed({ freq: 5200, filterType: 'highpass', q: 0.5, gain: 0.07 * (a.sand ?? 0.05), lfoRate: 0.15, lfoDepth: 0.02, pan: -0.4 });
      // Đô thị / mật độ dân số
      if ((p.urban || 0) > 0.04) {
        this._bed({ freq: 900, filterType: 'bandpass', q: 0.9, gain: 0.1 * p.urban, lfoRate: 0.6, lfoDepth: 0.02, pan: 0.15 });
      }

      // Drone nền: quãng 5 + quãng 8, lọc theo độ cao
      const root = midiToFreq(p.rootMidi - 12);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(2400, p.brightness * 0.5);
      filter.Q.value = 0.6;
      const pad = ctx.createGain();
      pad.gain.value = 0.075;
      filter.connect(pad);
      pad.connect(this.gain);
      [0, 7, 12, 19].forEach((semi, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = root * 2 ** (semi / 12);
        osc.detune.value = (i - 1.5) * 4;
        osc.connect(filter);
        osc.start();
        this.ambient.push(osc);
      });
      // LFO thở chậm cho drone
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05;
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(pad.gain);
      lfo.start();
      this.ambient.push(lfo, filter, pad);
      pad.gain.setTargetAtTime(0.08, t0, 1.2);
    } else {
      // Nền ambient theo nhiệt độ
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = p.brightness;
      filter.Q.value = 0.9;
      const pad = ctx.createGain();
      pad.gain.value = 0;
      filter.connect(pad);
      pad.connect(this.gain);
      (p.chord || [0, 3, 7, 10]).forEach((semi, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? 'triangle' : 'sine';
        osc.frequency.value = midiToFreq(p.rootMidi + semi);
        osc.detune.value = (i - 1.5) * 6;
        osc.connect(filter);
        osc.start();
        this.ambient.push(osc);
      });
      pad.gain.setTargetAtTime((p.padGain || 0.35) * 0.16, t0, 1.6);
      // LFO mở/đóng bộ lọc rất chậm
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.035;
      lfoGain.gain.value = Math.min(600, p.brightness * 0.18);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.ambient.push(lfo, filter, pad);

      // Gió
      this._bed({ freq: 620 + Math.min(900, p.wind * 12), filterType: 'bandpass', q: 0.8, gain: 0.28 * (p.windGain ?? 0.1), lfoRate: 0.08, lfoDepth: 0.06, pan: -0.25 });
      // Mưa
      this._bed({ freq: 2400, filterType: 'highpass', q: 0.4, gain: 0.4 * (p.rainGain ?? 0), lfoRate: 0.2, lfoDepth: 0.02, pan: 0.3 });
      // Mây / ẩm — lớp nền mờ
      this._bed({ freq: 1100, filterType: 'lowpass', q: 0.5, gain: 0.05 + 0.12 * (p.cloudiness ?? 0.4), lfoRate: 0.05, lfoDepth: 0.03, pan: 0 });
    }
  }

  _killAmbient() {
    this.ambient.forEach((n) => {
      try { if (typeof n.stop === 'function') n.stop(); } catch (e) { /* đã dừng */ }
      try { n.disconnect(); } catch (e) { /* bỏ qua */ }
    });
    this.ambient = [];
  }

  /* ----------------------------- transport ------------------------------ */
  play() {
    if (!this.ctx || !this.profile) return false;
    if (this.playing) return true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.ambient.length) this._buildAmbient();
    this.playing = true;
    this._startedAt = this.ctx.currentTime - this.position;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(this.effectiveGain(), now, 0.06);
    this._reindex();
    clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), 100);
    this._tick();
    return true;
  }

  pause() {
    if (!this.playing) return;
    this.position = this.getPosition();
    this.playing = false;
    clearInterval(this._timer);
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  stop() {
    if (this.playing) this.pause();
    this.position = 0;
    this._idx = 0;
    this._killAmbient();
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }

  restart() {
    this.seekTo(0);
    if (!this.playing) this.play();
  }

  seekTo(sec) {
    const target = Math.max(0, Math.min(this.duration - 0.05, sec));
    if (this.playing) {
      this.position = target;
      this._startedAt = this.ctx.currentTime - target;
      this._reindex();
    } else {
      this.position = target;
      this._reindex();
    }
  }

  seekBy(delta) {
    const base = this.playing ? this.getPosition() : this.position;
    this.seekTo(base + delta);
    return this.playing ? this.getPosition() : this.position;
  }

  getPosition() {
    if (!this.playing || !this.ctx) return Math.min(this.position, this.duration);
    const elapsed = this.ctx.currentTime - this._startedAt;
    return Math.min(this.duration, Math.max(0, elapsed));
  }

  _reindex() {
    const pos = this.playing ? this.getPosition() : this.position;
    this._idx = 0;
    while (this._idx < this.events.length && this.events[this._idx].t < pos) this._idx += 1;
    this._dropletNext = 0;
  }

  _tick() {
    if (!this.playing || !this.ctx) return;
    const pos = this.getPosition();
    if (pos >= this.duration - 0.05) {
      // lặp lại bản nhạc
      this.position = 0;
      this._startedAt = this.ctx.currentTime;
      this._idx = 0;
      this._dropletNext = 0;
      return;
    }
    const horizon = pos + 0.28;
    while (this._idx < this.events.length && this.events[this._idx].t <= horizon) {
      const ev = this.events[this._idx];
      this._idx += 1;
      const when = this._startedAt + ev.t;
      if (when >= this.ctx.currentTime - 0.08) this._voice(ev, Math.max(this.ctx.currentTime, when));
    }
    // Hạt mưa rời rạc theo lượng mưa
    const p = this.profile;
    if (p && p.kind === 'climate' && p.rainDensity > 1) {
      const now = this.ctx.currentTime;
      if (this._dropletNext < now) {
        const interval = 1 / Math.max(1, p.rainDensity * this.tempo);
        this._dropletNext = now + interval * (0.6 + Math.random() * 0.8);
        this._droplet(now + 0.02);
      }
    }
  }

  _voice(ev, when) {
    if (ev.type === 'hazard') { this._hazard(ev, when); return; }
    const inst = this.profile?.instrument || 'pluck';
    if (inst === 'drum') { this._drum(ev, when); return; }
    if (inst === 'sao') { this._flute(ev, when); return; }
    if (inst === 'dan-bau') { this._bowed(ev, when); return; }
    this._pluck(ev, when, inst === 'dan-tranh');
  }

  _panner(pan) {
    const ctx = this.ctx;
    if (this.spatial && ctx.createPanner) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.5;
      p.maxDistance = 24;
      p.rolloffFactor = 0.7;
      const angle = ((this.spatialAngle + (pan || 0) * 42) * Math.PI) / 180;
      const radius = 4;
      const x = Math.sin(angle) * radius;
      const z = -Math.cos(angle) * radius;
      if (p.positionX) {
        p.positionX.value = x;
        p.positionY.value = 0;
        p.positionZ.value = z;
      } else if (p.setPosition) {
        p.setPosition(x, 0, z);
      }
      return p;
    }
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) p.pan.value = pan || 0;
    return p;
  }

  _connectOut(node, panner) {
    if (panner) { node.connect(panner); panner.connect(this.gain); }
    else node.connect(this.gain);
  }

  /** Đàn tranh / pluck tổng hợp: dây gảy sáng, tắt nhanh. */
  _pluck(ev, when, bright = false) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const panner = this._panner(ev.pan);
    const filt = ctx.createBiquadFilter();
    filt.type = bright ? 'bandpass' : 'lowpass';
    filt.frequency.value = bright
      ? Math.min(5200, ev.freq * 5)
      : (ev.type === 'bell' ? Math.min(9000, (this.profile?.brightness || 2000) * 1.6) : (this.profile?.brightness || 2200));
    filt.Q.value = bright ? 1.4 : 0.8;
    osc.type = bright ? 'sawtooth' : (ev.type === 'bell' ? 'sine' : 'triangle');
    osc.frequency.value = ev.freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, ev.gain * (bright ? 0.7 : 1)), when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, when + ev.dur);
    osc.connect(env);
    env.connect(filt);
    this._connectOut(filt, panner);
    if (bright) {
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = ev.freq * 2.004;
      g2.gain.value = 0.35;
      osc2.connect(g2); g2.connect(env);
      osc2.start(when); osc2.stop(when + ev.dur + 0.05);
      osc2.onended = () => { try { osc2.disconnect(); g2.disconnect(); } catch (e) { /* noop */ } };
    }
    osc.start(when);
    osc.stop(when + ev.dur + 0.05);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); filt.disconnect(); if (panner) panner.disconnect(); } catch (e) { /* noop */ } };
  }

  /** Thiên tai: tiếng trầm lan + lớp ồn cho động đất/bão. */
  _hazard(ev, when) {
    const ctx = this.ctx;
    const panner = this._panner(ev.pan);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    lp.Q.value = 1.1;
    const base = ev.kind === 'storm' ? 88 : 33;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 1.9, when);
    osc.frequency.exponentialRampToValueAtTime(base, when + 0.6);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.03, ev.gain), when + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    osc.connect(env); env.connect(lp); this._connectOut(lp, panner);
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 340;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.0001, when);
    ne.gain.exponentialRampToValueAtTime(Math.max(0.01, ev.gain * 0.9), when + 0.08);
    ne.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
    src.connect(bp); bp.connect(ne); this._connectOut(ne, panner);
    osc.start(when); src.start(when, Math.random() * 3, 1.5);
    osc.stop(when + 1.75);
    osc.onended = () => { try { [osc, env, lp, src, bp, ne, panner].forEach((n) => n && n.disconnect()); } catch (e) { /* noop */ } };
  }

  /** Sáo: hơi thở + rung nhẹ, tấn công chậm. */
  _flute(ev, when) {
    const ctx = this.ctx;
    const panner = this._panner(ev.pan);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(6000, ev.freq * 6);
    filt.Q.value = 0.6;
    osc.type = 'sine';
    osc.frequency.value = ev.freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, ev.gain * 0.9), when + 0.09);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.25, ev.dur * 1.2));
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 4.8;
    vibGain.gain.value = Math.min(6, ev.freq * 0.008);
    vib.connect(vibGain); vibGain.connect(osc.frequency);
    osc.connect(env); env.connect(filt); this._connectOut(filt, panner);
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(4200, ev.freq * 3);
    bp.Q.value = 1.1;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.0001, when);
    ne.gain.exponentialRampToValueAtTime(Math.max(0.002, ev.gain * 0.28), when + 0.06);
    ne.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    src.connect(bp); bp.connect(ne); this._connectOut(ne, panner);
    osc.start(when); vib.start(when); src.start(when, Math.random() * 3, 0.22);
    const stopAt = when + Math.max(0.3, ev.dur * 1.2) + 0.2;
    osc.stop(stopAt); vib.stop(stopAt);
    osc.onended = () => { try { [osc, env, filt, vib, vibGain, src, bp, ne, panner].forEach((n) => n && n.disconnect()); } catch (e) { /* noop */ } };
  }

  /** Đàn bầu: cung mềm, vuốt cao độ và rung sâu. */
  _bowed(ev, when) {
    const ctx = this.ctx;
    const panner = this._panner(ev.pan);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = Math.min(3600, (this.profile?.brightness || 1800) * 0.9);
    filt.Q.value = 1;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(ev.freq * 0.955, when);
    osc.frequency.exponentialRampToValueAtTime(ev.freq, when + 0.16);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, ev.gain), when + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, when + ev.dur * 1.5);
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 5.2;
    vibGain.gain.value = Math.min(9, ev.freq * 0.012);
    vib.connect(vibGain); vibGain.connect(osc.frequency);
    osc.connect(env); env.connect(filt); this._connectOut(filt, panner);
    osc.start(when); vib.start(when);
    const stopAt = when + ev.dur * 1.5 + 0.1;
    osc.stop(stopAt); vib.stop(stopAt);
    osc.onended = () => { try { [osc, env, filt, vib, vibGain, panner].forEach((n) => n && n.disconnect()); } catch (e) { /* noop */ } };
  }

  /** Trống: cú đập trầm + tiếng da, dùng cho sa mạc. */
  _drum(ev, when) {
    const ctx = this.ctx;
    const panner = this._panner(ev.pan);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const base = Math.max(38, ev.freq / 2.4);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 2.3, when);
    osc.frequency.exponentialRampToValueAtTime(base, when + 0.13);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.02, ev.gain * 1.7), when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(0.5, Math.max(0.18, ev.dur)));
    osc.connect(env); this._connectOut(env, panner);
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.0001, when);
    ne.gain.exponentialRampToValueAtTime(Math.max(0.002, ev.gain * 0.8), when + 0.005);
    ne.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
    src.connect(lp); lp.connect(ne); this._connectOut(ne, panner);
    osc.start(when); src.start(when, Math.random() * 3, 0.15);
    osc.stop(when + 0.55);
    osc.onended = () => { try { [osc, env, src, lp, ne, panner].forEach((n) => n && n.disconnect()); } catch (e) { /* noop */ } };
  }

  _droplet(when) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const offset = Math.random() * Math.max(0, (this._noise?.duration || 1) - 0.1);
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 3000 + Math.random() * 2500;
    const env = ctx.createGain();
    const dur = 0.04 + Math.random() * 0.07;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.02 + Math.random() * 0.03, when + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(filt); filt.connect(env);
    if (panner) { env.connect(panner); panner.connect(this.gain); panner.pan.value = Math.random() * 1.6 - 0.8; } else env.connect(this.gain);
    src.start(when, offset, dur + 0.02);
    src.onended = () => { try { src.disconnect(); filt.disconnect(); env.disconnect(); if (panner) panner.disconnect(); } catch (e) { /* noop */ } };
  }

  /** Lấy dữ liệu waveform cho visualizer. */
  waveform(target) {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(target);
    return target;
  }
}

/* ---------------------------- Audio Engine ------------------------------- */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.masterVolume = 0.85;
    this.muted = false;
    this.tracks = { terrain: new Sonifier('terrain'), climate: new Sonifier('climate') };
    this.ready = false;
  }

  /** Phải gọi trong một user gesture. */
  ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio API không được hỗ trợ');
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoiseBuffer(this.ctx, 4);
      Object.values(this.tracks).forEach((tr) => tr.attach(this.ctx, this.master, this.noise));
      this.ready = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMaster(v) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.applyMaster();
  }

  muteAll(m) { this.muted = !!m; this.applyMaster(); }

  applyMaster() {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : this.masterVolume ** 1.4;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  loadProfiles(terrainProfile, climateProfile, seedKey) {
    this.tracks.terrain.load(terrainProfile, `${seedKey}-terrain`);
    this.tracks.climate.load(climateProfile, `${seedKey}-climate`);
  }

  /** Chỉ đổi track khí hậu (theo mùa) mà không đụng track địa hình. */
  loadClimate(climateProfile, seedKey) {
    this.tracks.climate.reload(climateProfile, seedKey);
  }

  stopAll() {
    Object.values(this.tracks).forEach((tr) => tr.stop());
  }

  setSpatial(on) {
    Object.values(this.tracks).forEach((tr) => tr.setSpatial(on));
  }

  setTempo(v) {
    Object.values(this.tracks).forEach((tr) => tr.setTempo(v));
  }

  clear() {
    this.stopAll();
    Object.values(this.tracks).forEach((tr) => { tr.profile = null; tr.events = []; });
  }
}
