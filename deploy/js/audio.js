(function () {
  "use strict";
  const VB = window.VB;

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.muted = false;
      this.started = false;
      this.mood = "calm";
      this.arpTimer = null;
      this.arpStep = 0;
      this.droneA = null;
      this.droneFilter = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.55;
        this.musicBus.connect(this.master);
        this.noiseBuffer = this.makeNoise();
      } catch (e) {
        this.ctx = null;
      }
    }

    makeNoise() {
      const len = Math.floor(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    ensure() {
      if (!this.ctx) return false;
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }

    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.04);
      }
    }

    tone(freq, dur, type, vol, slideTo, delay) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slideTo) {
        o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.06);
    }

    noise(dur, vol, filterFreq, type, delay) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type || "lowpass";
      filter.frequency.setValueAtTime(filterFreq || 1200, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, vol), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.05);
    }

    startMusic() {
      if (!this.ensure() || this.started) return;
      this.started = true;
      const ctx = this.ctx;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 340;
      filter.Q.value = 3;
      filter.connect(this.musicBus);

      const gain = ctx.createGain();
      gain.gain.value = 0.075;
      gain.connect(filter);
      this.droneFilter = filter;

      const oscA = ctx.createOscillator();
      oscA.type = "sawtooth";
      oscA.frequency.value = 55;
      const oscB = ctx.createOscillator();
      oscB.type = "sine";
      oscB.frequency.value = 82.41;
      oscB.detune.value = 6;
      oscA.connect(gain);
      oscB.connect(gain);
      oscA.start();
      oscB.start();
      this.droneA = oscA;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.34;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(this.musicBus);
      this.echo = delay;

      const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
      this.arpTimer = setInterval(() => {
        if (!this.ctx || this.muted) return;
        if (Math.random() < 0.24) return;
        const note = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "triangle";
        o.frequency.value = note;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(this.mood === "calm" ? 0.022 : 0.038, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g);
        g.connect(this.echo);
        g.connect(this.musicBus);
        o.start(t);
        o.stop(t + 1);
      }, 780);
    }

    setMood(mood) {
      if (this.mood === mood) return;
      this.mood = mood;
      if (!this.ctx || !this.droneFilter) return;
      const target =
        mood === "boss" || mood === "escape" ? 1100 : mood === "combat" ? 620 : 340;
      this.droneFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.1);
    }

    shoot(level) {
      const base = level > 1 ? 1320 : 980;
      this.tone(base, 0.07, "square", 0.045, base * 0.28);
      this.noise(0.04, 0.025, 3200, "highpass");
    }

    enemyShoot() {
      this.tone(420, 0.12, "sawtooth", 0.028, 150);
    }

    enemyHit() {
      this.tone(260, 0.05, "square", 0.03, 140);
      this.noise(0.05, 0.02, 2400, "bandpass");
    }

    hit() {
      this.noise(0.08, 0.05, 4200, "highpass");
      this.tone(1200, 0.025, "square", 0.018, 700);
    }

    hurt() {
      this.noise(0.28, 0.1, 700, "lowpass");
      this.tone(160, 0.32, "sawtooth", 0.07, 48);
    }

    explode(big) {
      this.noise(big ? 0.7 : 0.34, big ? 0.16 : 0.09, big ? 900 : 1400, "lowpass");
      this.tone(big ? 96 : 140, big ? 0.6 : 0.26, "sine", big ? 0.1 : 0.05, 32);
    }

    dash() {
      this.noise(0.22, 0.06, 2200, "bandpass");
      this.tone(520, 0.22, "sine", 0.03, 1400);
    }

    pickup() {
      this.tone(660, 0.09, "triangle", 0.05);
      this.tone(990, 0.14, "triangle", 0.045, 1320, 0.06);
    }

    key() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this.tone(f, 0.22, "triangle", 0.05, null, i * 0.07)
      );
    }

    upgrade() {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this.tone(f, 0.34, "sawtooth", 0.028, f * 1.01, i * 0.06)
      );
      this.noise(0.4, 0.03, 3000, "highpass");
    }

    gate() {
      this.noise(0.4, 0.06, 600, "lowpass");
      this.tone(110, 0.34, "square", 0.04, 55);
      this.tone(440, 0.18, "sine", 0.03, 660, 0.12);
    }

    beep(high) {
      this.tone(high ? 880 : 620, 0.09, "square", 0.035);
    }

    alarm() {
      for (let i = 0; i < 4; i++) {
        this.tone(740, 0.11, "square", 0.035, 540, i * 0.26);
        this.tone(990, 0.11, "square", 0.025, 740, i * 0.26 + 0.11);
      }
    }

    bossRoar() {
      this.tone(48, 1.4, "sawtooth", 0.09, 30);
      this.noise(1.1, 0.05, 260, "lowpass");
      this.tone(180, 0.7, "square", 0.03, 60, 0.1);
    }

    taunt() {
      this.tone(330, 0.12, "sine", 0.02, 220);
    }

    death() {
      [392, 329.63, 261.63, 196, 98].forEach((f, i) =>
        this.tone(f, 0.6, "sawtooth", 0.05, f * 0.7, i * 0.14)
      );
      this.noise(1.2, 0.08, 500, "lowpass");
    }

    win() {
      [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
        this.tone(f, 0.9, "triangle", 0.05, null, i * 0.1)
      );
      this.tone(130.81, 1.4, "sine", 0.07, null, 0.1);
    }

    ui() {
      this.tone(760, 0.05, "square", 0.022, 880);
    }
  }

  VB.AudioEngine = AudioEngine;
})();
