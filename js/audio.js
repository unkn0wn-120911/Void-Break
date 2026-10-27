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
      this.voiceOn = true;
      this.voicePicked = null;
      try {
        if (localStorage.getItem("vb-voice") === "0") this.voiceOn = false;
      } catch (e) {}
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
      if (m && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
    }

    setVoice(on) {
      this.voiceOn = !!on;
      try {
        localStorage.setItem("vb-voice", this.voiceOn ? "1" : "0");
      } catch (e) {}
      if (!this.voiceOn && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
    }

    /* The announcer voice for kill streaks. Silent when the browser has no
       English voice, so the synth sting always carries the moment on its own. */
    speak(line) {
      if (!this.voiceOn || this.muted) return;
      const synth = window.speechSynthesis;
      if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;
      try {
        synth.cancel();
        const u = new window.SpeechSynthesisUtterance(line);
        u.lang = "en-US";
        u.rate = 1.04;
        u.pitch = 0.55;
        u.volume = 0.95;
        const v = this.pickVoice(synth);
        if (v) u.voice = v;
        synth.speak(u);
      } catch (e) {}
    }

    pickVoice(synth) {
      if (this.voicePicked) return this.voicePicked;
      let list = [];
      try {
        list = synth.getVoices() || [];
      } catch (e) {
        return null;
      }
      const en = list.filter((v) => /^en/i.test(v.lang || ""));
      if (!en.length) return null;
      this.voicePicked =
        en.filter((v) => /male|daniel|alex|uk english natural|google us english/i.test(v.name))[0] ||
        en[0];
      return this.voicePicked;
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

    // Noise through a band that slides down from f0 to f1. This sweeping body
    // is what separates a gunshot from a hiss.
    sweepNoise(dur, vol, f0, f1, type, delay) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.9 + Math.random() * 0.3;
      const filter = ctx.createBiquadFilter();
      filter.type = type || "bandpass";
      filter.Q.value = type === "lowpass" || type === "highpass" ? 0.9 : 1.3;
      filter.frequency.setValueAtTime(Math.max(40, f0), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0002, vol), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.5);
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

    /* One layered report per weapon family: transient crack, sweeping body,
       pitched muzzle thump. Each shot jitters in pitch so bursts never sound
       like the same sample replaying. */
    gun(kind, mk2) {
      if (!this.ensure()) return;
      const k = mk2 ? 1.08 : 1;
      const j = 0.94 + Math.random() * 0.13;
      this.sweepNoise(0.012, 0.07, 6200, 2400, "highpass");

      if (kind === "smg") {
        this.sweepNoise(0.048, 0.058 * j, 2600 * k, 560, "bandpass");
        this.tone(205 * k * j, 0.05, "square", 0.032, 88);
        this.tone(1450, 0.02, "triangle", 0.018, 640, 0.004);
      } else if (kind === "cannon") {
        this.sweepNoise(0.19, 0.12, 1900 * k, 190, "lowpass");
        this.tone(122 * j, 0.24, "sine", 0.115, 33);
        this.tone(720, 0.055, "square", 0.03, 210);
        this.sweepNoise(0.3, 0.032, 900, 170, "lowpass", 0.035);
      } else if (kind === "shotgun") {
        this.sweepNoise(0.13, 0.1, 2700 * k, 320, "lowpass");
        this.tone(148 * j, 0.16, "sine", 0.075, 42);
        this.sweepNoise(0.1, 0.04, 5200, 1500, "highpass", 0.012);
      } else if (kind === "rail") {
        this.tone(1780 * k, 0.34, "sawtooth", 0.05, 210);
        this.sweepNoise(0.24, 0.075, 5200 * k, 300, "bandpass");
        this.tone(96 * j, 0.3, "sine", 0.075, 31);
        this.sweepNoise(0.12, 0.03, 8600, 4200, "highpass", 0.02);
      } else if (kind === "launcher") {
        this.tone(178 * j, 0.13, "square", 0.055, 62);
        this.sweepNoise(0.1, 0.07, 900 * k, 180, "lowpass");
        this.sweepNoise(0.34, 0.028, 300, 90, "lowpass", 0.05);
      } else if (kind === "arc") {
        this.sweepNoise(0.055, 0.05, 4400 * k, 1500, "bandpass");
        this.tone(1020 * j, 0.075, "sawtooth", 0.026, 2650);
        this.tone(268 * k, 0.05, "triangle", 0.03, 150);
      } else if (kind === "carbine") {
        this.sweepNoise(0.058, 0.072 * j, 3600 * k, 820, "bandpass");
        this.tone(300 * k * j, 0.055, "square", 0.036, 120);
        this.tone(1650, 0.02, "triangle", 0.016, 700, 0.005);
      } else {
        this.sweepNoise(0.072, 0.08 * j, 3300 * k, 640, "bandpass");
        this.tone(245 * k * j, 0.075, "square", 0.042, 96);
        this.tone(1250, 0.028, "triangle", 0.02, 520, 0.006);
      }
    }

    /* Ability layer — one shared charge sting plus a flavour hit per shape. */
    cast() {
      if (!this.ensure()) return;
      this.tone(320, 0.2, "triangle", 0.04, 900);
      this.sweepNoise(0.16, 0.03, 900, 2600, "bandpass");
    }

    novaBlast() {
      if (!this.ensure()) return;
      this.tone(84, 0.5, "sine", 0.12, 26);
      this.sweepNoise(0.42, 0.1, 2400, 180, "lowpass");
      this.tone(520, 0.16, "square", 0.03, 120);
    }

    beamBlast() {
      if (!this.ensure()) return;
      this.sweepNoise(0.34, 0.075, 7200, 480, "bandpass");
      this.tone(1450, 0.28, "sawtooth", 0.028, 340);
    }

    zoneDrop() {
      if (!this.ensure()) return;
      this.tone(150, 0.34, "sine", 0.07, 48);
      this.sweepNoise(0.26, 0.055, 700, 120, "lowpass", 0.02);
    }

    surgeUp() {
      if (!this.ensure()) return;
      [0, 3, 7, 10, 12].forEach((semi, i) =>
        this.tone(330 * Math.pow(2, semi / 12), 0.3, "triangle", 0.028, null, i * 0.045)
      );
      this.tone(66, 0.5, "sine", 0.055, 132);
    }

    phaseJump() {
      if (!this.ensure()) return;
      this.sweepNoise(0.18, 0.05, 300, 3600, "bandpass");
      this.tone(1200, 0.14, "sine", 0.035, 320);
    }

    /* Squad-link chain: pitch climbs with every link in the combo. */
    linkUp(n) {
      if (!this.ensure()) return;
      const f = 523.25 * Math.pow(2, (Math.min(n, 5) - 1) / 6);
      this.tone(f, 0.16, "triangle", 0.042, f * 1.5);
      this.tone(f * 1.5, 0.22, "sine", 0.03, f * 2, 0.05);
    }

    overload() {
      if (!this.ensure()) return;
      this.tone(55, 1.1, "sine", 0.13, 30);
      this.sweepNoise(0.9, 0.09, 5200, 130, "lowpass");
      [261.6, 392, 523.25, 784].forEach((f, i) =>
        this.tone(f, 0.6, "sawtooth", 0.026, f * 0.7, i * 0.06)
      );
    }

    deny() {
      if (!this.ensure()) return;
      this.tone(240, 0.09, "square", 0.03, 150);
      this.tone(180, 0.11, "square", 0.026, 110, 0.07);
    }

    enemyShoot() {
      this.tone(420, 0.12, "sawtooth", 0.028, 150);
    }

    /* Confirmation tick on every bullet that connects. */
    enemyHit() {
      this.tone(2450, 0.019, "square", 0.03, 1950);
      this.tone(3250, 0.015, "square", 0.019, 2700, 0.011);
      this.sweepNoise(0.02, 0.016, 5200, 2300, "highpass");
    }

    /* Distinct "target down" sting so a kill reads differently from a hit. */
    killConfirm() {
      this.tone(1180, 0.07, "triangle", 0.048, 1580);
      this.tone(1580, 0.12, "triangle", 0.04, 1180, 0.055);
      this.tone(78, 0.2, "sine", 0.065, 40);
      this.sweepNoise(0.16, 0.038, 1500, 260, "lowpass");
    }

    /* Streak fanfare — the root pitch climbs with the streak count. */
    announce(tier) {
      const root = 392 * Math.pow(2, (Math.min(tier, 6) - 1) / 12);
      [0, 4, 7, 12].forEach((semi, i) =>
        this.tone(root * Math.pow(2, semi / 12), 0.26, "sawtooth", 0.033, null, i * 0.052)
      );
      this.tone(root / 2, 0.42, "sine", 0.075, root / 2.3);
      this.sweepNoise(0.3, 0.035, 3000, 420, "lowpass", 0.02);
    }

    booyah() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        this.tone(f, 0.5, "triangle", 0.048, f * 1.004, i * 0.072)
      );
      this.tone(130.81, 0.9, "sine", 0.085);
      this.sweepNoise(0.6, 0.045, 4000, 320, "lowpass", 0.05);
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
  VB.stage && VB.stage("audio");
})();
