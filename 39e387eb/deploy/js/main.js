(function () {
  "use strict";
  const VB = window.VB;
  const T = VB.TILE;
  const TAU = VB.TAU;

  class Game {
    constructor() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");
      this.input = new VB.Input(this.canvas);
      this.audio = new VB.AudioEngine();
      this.touchMode = false;
      this.touch = new VB.TouchControls(this);

      this.state = "title";
      this.time = 0;
      this.last = performance.now();
      this.runTime = 0;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = 1;

      this.lightCanvas = document.createElement("canvas");
      this.lightCtx = this.lightCanvas.getContext("2d");

      this.camera = { x: 0, y: 0, shake: 0 };
      this.viewX = 0;
      this.viewY = 0;

      this.world = null;
      this.player = null;
      this.boss = null;
      this.enemies = [];
      this.playerBullets = [];
      this.enemyBullets = [];
      this.pickups = [];
      this.barrels = [];
      this.particles = new VB.Particles();
      this.texts = [];
      this.toasts = [];
      this.pendingBarrels = [];
      this.prompt = null;
      this.dialog = null;
      this.dialogQueue = [];
      this.activeLog = null;

      this.kills = 0;
      this.logsRead = 0;
      this.bossDefeated = false;
      this.escapeActive = false;
      this.escapeTimer = 0;
      this.lastBeep = 99;
      this.damageFlash = 0;
      this.flash = 0;
      this.revealTimer = 0;
      this.moodTimer = 0;

      this.resize();
      this.titleStars = this.makeTitleStars();
      this.bindUI();
      if (VB.TouchControls.supported) this.touch.enable();

      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);

      window.__VOIDBREAK__ = this;
    }

    /* ============================ setup ============================ */

    resize() {
      this.width = Math.max(320, window.innerWidth);
      this.height = Math.max(320, window.innerHeight);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = this.width + "px";
      this.canvas.style.height = this.height + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.lightCanvas.width = this.width;
      this.lightCanvas.height = this.height;
      this.titleStars = this.makeTitleStars();
      if (this.touchMode) this.touch.measure();
      if (this.world && this.player) this.updateCamera(0.016, true);
    }

    makeTitleStars() {
      const count = VB.clamp(Math.floor((this.width * this.height) / 7500), 90, 260);
      const stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random(),
          z: VB.rand(0.15, 1),
          tw: VB.rand(0, TAU),
          drift: VB.rand(1.5, 9),
        });
      }
      return stars;
    }

    showOnly(name) {
      document.querySelectorAll(".screen").forEach((el) => {
        el.classList.toggle("active", el.id === "screen-" + name);
      });
    }

    syncMuteUI() {
      const btn = document.getElementById("btn-pause-mute");
      if (btn) btn.textContent = "AUDIO: " + (this.audio.muted ? "OFF" : "ON");
    }

    bindUI() {
      const on = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", fn);
      };

      on("btn-start", () => this.startRun());
      on("btn-resume", () => this.resume());
      on("btn-pause-restart", () => this.startRun());
      on("btn-pause-mute", () => {
        this.audio.setMuted(!this.audio.muted);
        this.syncMuteUI();
        this.audio.ui();
      });
      on("btn-pause-quit", () => this.goTitle());
      on("btn-retry", () => this.startRun());
      on("btn-dead-quit", () => this.goTitle());
      on("btn-again", () => this.startRun());
      on("btn-win-quit", () => this.goTitle());
      on("btn-log-close", () => this.closeLog());

      window.addEventListener("keydown", (e) => {
        if (e.code === "Escape") {
          if (this.state === "playing") this.pause();
          else if (this.state === "paused") this.resume();
          else if (this.state === "log") this.closeLog();
        }
        if (e.code === "KeyM") {
          this.audio.init();
          this.audio.setMuted(!this.audio.muted);
          this.syncMuteUI();
          if (this.state === "playing") {
            this.toast(this.audio.muted ? "AUDIO MUTED" : "AUDIO ONLINE", "cyan", 1.6);
          }
        }
        if (e.code === "KeyE" && this.state === "log") {
          this.closeLog();
        }
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          if (this.state === "title" || this.state === "dead" || this.state === "victory") {
            this.startRun();
          }
        }
      });

      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => this.resize());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === "playing") this.pause();
      });

      this.initInstallUI();
      this.initUpdateCheck();
    }

    /* ============================ install + updates ============================ */

    siteRoot() {
      const cfg = window.VB_BUILD;
      if (cfg && cfg.site) return String(cfg.site).replace(/\/+$/, "") + "/";
      if (location.protocol === "file:") return "";
      return location.href.replace(/[^/]*(\?.*)?$/, "");
    }

    initInstallUI() {
      const row = document.getElementById("apk-row");
      const note = document.getElementById("apk-note");
      const btn = document.getElementById("btn-apk");
      const alt = document.getElementById("btn-apk-offline");
      const dismiss = document.getElementById("btn-apk-dismiss");
      const chip = document.getElementById("update-chip");
      if (chip) chip.addEventListener("click", () => this.reloadToLatest());
      if (!row || !btn) return;
      // Inside the Android app there is nothing to install, and the update chip
      // above is still wired to reloadToLatest().
      if (window.VB_BUILD || window.AndroidBridge) return;
      // Opened straight from disk the /download path has no server behind it.
      if (location.protocol === "file:") return;

      const ua = navigator.userAgent || "";
      const android = /Android/i.test(ua);
      const ios =
        /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      let dismissed = false;
      try {
        dismissed = localStorage.getItem("vb-apk-dismissed") === "1";
      } catch (err) {}

      if (ios) {
        btn.hidden = true;
        if (alt) alt.hidden = true;
        if (dismiss) dismiss.hidden = true;
        note.textContent = "ANDROID FILE ONLY — USE THE BROWSER, OR ADD THIS PAGE TO YOUR HOME SCREEN";
      } else if (android) {
        note.textContent = "ANDROID 8+ · AUTO-UPDATES AFTER EVERY DEPLOY";
      } else {
        note.textContent = "SIDESLOADS ONTO ANY ANDROID PHONE · ANDROID 8+";
      }

      if (dismissed) return;
      row.hidden = false;
      if (dismiss) {
        dismiss.addEventListener("click", () => {
          row.hidden = true;
          try {
            localStorage.setItem("vb-apk-dismissed", "1");
          } catch (err) {}
        });
      }
    }

    reloadToLatest() {
      const cfg = window.VB_BUILD;
      const root = this.siteRoot();
      if (cfg && cfg.mode === "offline" && root) {
        location.href = root + "?v=" + Date.now();
      } else {
        location.reload();
      }
    }

    initUpdateCheck() {
      const root = this.siteRoot();
      if (!root) return;
      const chip = document.getElementById("update-chip");
      const check = () => {
        fetch(root + "version.json?ts=" + Date.now(), { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d || !d.version || d.version === VB.VERSION) return;
            this.latestVersion = d.version;
            if (!chip) return;
            chip.hidden = false;
            chip.textContent = "";
            const dot = document.createElement("span");
            dot.className = "dot";
            chip.appendChild(dot);
            chip.appendChild(
              document.createTextNode(
                (window.VB_BUILD ? "NEW BUILD AVAILABLE — PLAY LATEST" : "NEW BUILD DEPLOYED — RELOAD TO PATCH") +
                  " v" +
                  d.version
              )
            );
            chip.title = d.notes || "Patch available";
          })
          .catch(() => {});
      };
      check();
      setInterval(check, 60000);
    }

    /* ============================ platform helpers ============================ */

    setTouch(on) {
      if (on) this.touch.enable();
      else this.touch.disable();
      this.resize();
    }

    requestImmersive() {
      if (!this.touchMode) return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      const so = window.screen && window.screen.orientation;
      if (so && so.lock) so.lock("landscape").catch(() => {});
    }

    onBack() {
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
      else if (this.state === "log") this.closeLog();
      else if (this.state === "dead" || this.state === "victory") this.goTitle();
      else if (window.AndroidBridge) window.AndroidBridge.exit();
      return this.state;
    }

    /* ============================ state flow ============================ */

    startRun() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      this.audio.init();
      this.audio.setMuted(this.audio.muted);
      this.audio.startMusic();
      this.audio.setMood("calm");
      this.syncMuteUI();
      this.resetRun();
      this.state = "playing";
      this.canvas.style.cursor = "none";
      this.showOnly(null);
      this.requestImmersive();
      this.last = performance.now();

      this.say("Clamps secured. Atmosphere thin. Reactor signature... unstable.", 3.4, "KESTREL");
      this.say("Another scavenger. The crew left me. You will stay.", 4.6, "AURORA");
      this.say("Big talk from a voice in the walls. I'm here for the salvage.", 3.8, "ROOK");
      this.introLock = true;

      this.toast("DIRECTIVE: RECOVER THE CYAN KEYCARD", "cyan", 4.2);
      this.audio.gate();
    }

    resetRun() {
      const world = new VB.World();
      this.world = world;
      this.player = new VB.Player(world.spawn.x, world.spawn.y);
      this.enemies = [];
      this.playerBullets = [];
      this.enemyBullets = [];
      this.pickups = [];
      this.barrels = [];
      this.particles = new VB.Particles();
      this.texts = [];
      this.toasts = [];
      this.pendingBarrels = [];
      this.boss = new VB.Boss(50.5 * T, 11.5 * T);
      this.kills = 0;
      this.logsRead = 0;
      this.bossDefeated = false;
      this.escapeActive = false;
      this.escapeTimer = 0;
      this.lastBeep = 99;
      this.runTime = 0;
      this.damageFlash = 0;
      this.flash = 0;
      this.revealTimer = 0;
      this.moodTimer = 0;
      this.dialog = null;
      this.dialogQueue = [];
      this.introLock = false;
      this.prompt = null;
      this.activeLog = null;
      this.camera = { x: 0, y: 0, shake: 0 };

      this.cyanPos = { x: 14 * T, y: 14 * T };
      this.goldPos = { x: 53.5 * T, y: 36 * T };
      this.airlockPos = { x: world.airlock.x, y: world.airlock.y };

      this.spawnWorldEntities();
      this.setObjective("cyan");

      // starting sector
      const dock = world.roomById("docking");
      if (dock) dock.discovered = true;
      world.revealAt(this.player.x, this.player.y, 7);
      world.revealAt(this.world.airlock.x, this.world.airlock.y, 4);

      this.updateCamera(0.016, true);
      this.audio.setMood("calm");
    }

    goTitle() {
      this.state = "title";
      this.showOnly("title");
      this.canvas.style.cursor = "crosshair";
      this.audio.setMood("calm");
      this.input.keys.clear();
      this.input.mouse.down = false;
    }

    pause() {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.showOnly("pause");
      this.canvas.style.cursor = "default";
      this.syncMuteUI();
      this.audio.ui();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.showOnly(null);
      this.canvas.style.cursor = "none";
      this.last = performance.now();
      this.audio.ui();
    }

    onPlayerDeath(reason) {
      if (this.state !== "playing") return;
      this.state = "dead";
      this.deadReason = reason;
      this.canvas.style.cursor = "default";
      this.audio.death();
      this.audio.setMood("calm");
      this.particles.burst(this.player.x, this.player.y, "#ff6b7d", 40, {
        speedMax: 360,
        sizeMax: 4,
        lifeMax: 1.2,
      });
      this.particles.ring(this.player.x, this.player.y, "#ff4d63", 120, 0.9);
      this.shake(20);
      this.player.dead = true;

      document.getElementById("dead-reason").textContent = reason;
      document.getElementById("dead-time").textContent = VB.formatTime(this.runTime);
      document.getElementById("dead-kills").textContent = String(this.kills);
      document.getElementById("dead-logs").textContent = `${this.logsRead} / 5`;
      this.showOnly("dead");
    }

    winGame() {
      if (this.state !== "playing") return;
      this.state = "victory";
      this.canvas.style.cursor = "default";
      this.audio.win();
      this.audio.setMood("calm");
      document.getElementById("win-time").textContent = VB.formatTime(this.runTime);
      document.getElementById("win-kills").textContent = String(this.kills);
      document.getElementById("win-logs").textContent = `${this.logsRead} / 5`;
      this.showOnly("win");
    }

    openLog(term) {
      if (this.state !== "playing") return;
      this.state = "log";
      this.activeLog = term;
      if (!term.read) {
        term.read = true;
        this.logsRead += 1;
      }
      document.getElementById("log-title").textContent = term.title;
      document.getElementById("log-meta").textContent = term.meta;
      document.getElementById("log-body").textContent = term.body;
      this.showOnly("log");
      this.canvas.style.cursor = "default";
      this.audio.ui();
    }

    closeLog() {
      if (this.state !== "log") return;
      this.state = "playing";
      this.showOnly(null);
      this.canvas.style.cursor = "none";
      this.last = performance.now();
      this.input.pressed.delete("KeyE");
      this.audio.ui();
    }

    /* ============================ spawning ============================ */

    spawnEnemyAt(type, x, y) {
      const e = new VB.Enemy(type, x, y, this);
      this.enemies.push(e);
      return e;
    }

    spawnWorldEntities() {
      const S = (type, tx, ty) => this.spawnEnemyAt(type, tx * T, ty * T);

      // Docking Bay — one crawler to teach the trigger
      S("crawler", 13.5, 39);

      // Medical wing
      S("crawler", 23, 39.5);
      S("crawler", 28.5, 35.5);
      S("drone", 27, 38);

      // Atrium
      S("drone", 31, 26);
      S("drone", 36, 28);
      S("crawler", 29.5, 23.5);

      // Security
      S("turret", 8.5, 16.5);
      S("turret", 17, 9.5);
      S("drone", 12, 8.5);
      S("drone", 16, 15);
      S("crawler", 10, 13);

      // Armory (optional)
      S("turret", 30, 12.5);
      S("drone", 36, 12);

      // Engineering
      S("sentinel", 52, 28.5);
      S("crawler", 46, 36);
      S("crawler", 55, 38);
      S("drone", 54, 31.5);
      S("turret", 48, 38.5);

      // Pickups
      this.pickups.push(new VB.Pickup("cyan", this.cyanPos.x, this.cyanPos.y));
      this.pickups.push(new VB.Pickup("gold", this.goldPos.x, this.goldPos.y));
      this.pickups.push(new VB.Pickup("upgrade", 34 * T, 10.8 * T));

      const healthSpots = [
        [24.5, 37.5],
        [28.5, 34.2],
        [6.5, 17],
        [47, 35.5],
        [13.5, 40.5],
        [50.5, 18],
      ];
      for (const h of healthSpots) {
        this.pickups.push(new VB.Pickup("health", h[0] * T, h[1] * T));
      }

      // volatile coolant canisters
      const barrels = [
        [27, 39],
        [38, 29.5],
        [52, 37],
        [47, 29.5],
        [55, 31],
        [47.5, 17],
        [54.5, 17],
      ];
      for (const b of barrels) {
        this.barrels.push(new VB.Barrel(b[0] * T, b[1] * T));
      }
    }

    spawnEscapeWave() {
      const spots = [
        ["drone", 31, 26],
        ["drone", 36, 28],
        ["crawler", 22, 39],
        ["crawler", 28, 36],
        ["drone", 13, 35],
      ];
      for (const s of spots) {
        const x = s[1] * T;
        const y = s[2] * T;
        if (VB.dist(this.player.x, this.player.y, x, y) < 260) continue;
        const e = this.spawnEnemyAt(s[0], x, y);
        e.active = true;
        e.spawnT = 0.55;
        this.particles.ring(x, y, "#ff45d8", 34, 0.5);
      }
    }

    dropHealth(x, y) {
      this.pickups.push(
        new VB.Pickup(
          "health",
          x + VB.rand(-8, 8),
          y + VB.rand(-8, 8)
        )
      );
    }

    /* ============================ progression ============================ */

    setObjective(id) {
      const cyan = "#4ef4ff";
      if (id === "cyan") {
        this.objective = {
          label: "DIRECTIVE 01",
          text: "Recover the CYAN security keycard from Security",
          tone: cyan,
          target: this.cyanPos,
        };
      } else if (id === "gold") {
        this.objective = {
          label: "DIRECTIVE 02",
          text: "Retrieve the REACTOR KEY from Engineering",
          tone: "#4ef4ff",
          target: this.goldPos,
        };
      } else if (id === "boss") {
        this.objective = {
          label: "DIRECTIVE 03",
          text: "Unlock the AI Core — shut down AURORA",
          tone: "#ff45d8",
          target: { x: 50.5 * T, y: 11.5 * T },
        };
      } else if (id === "escape") {
        this.objective = {
          label: "FINAL DIRECTIVE",
          text: "Reach Airlock 09 in the Docking Bay",
          tone: "#ff4d63",
          target: this.airlockPos,
        };
      }
    }

    collectPickup(pickup) {
      const p = this.player;
      if (pickup.type === "health") {
        if (p.hp >= p.maxHp) return false;
        p.heal(35, this);
        this.audio.pickup();
        this.particles.ring(p.x, p.y, "#5dffb0", 30, 0.4);
        return true;
      }

      if (pickup.type === "cyan") {
        p.keycards.cyan = true;
        this.audio.key();
        this.toast("CYAN CLEARANCE ACQUIRED — ARMORY & ENGINEERING UNLOCKED", "cyan", 4.4);
        this.floatText(p.x, p.y - 32, "CYAN CARD", "#4ef4ff");
        this.particles.ring(p.x, p.y, "#4ef4ff", 60, 0.8);
        this.setObjective("gold");
        this.say(
          "Ibarra's card. He cried when I sealed the armory. Will you cry too?",
          4.6,
          "AURORA"
        );
        return true;
      }

      if (pickup.type === "gold") {
        p.keycards.gold = true;
        this.audio.key();
        this.toast("REACTOR KEY ACQUIRED — AI CORE BULKHEAD UNLOCKED", "gold", 4.6);
        this.floatText(p.x, p.y - 32, "REACTOR KEY", "#ffd166");
        this.particles.ring(p.x, p.y, "#ffd166", 70, 0.9);
        this.setObjective("boss");
        this.say(
          "That key will cook my cooling loop. Do you know what it is like to freeze?",
          4.8,
          "AURORA"
        );
        return true;
      }

      if (pickup.type === "upgrade") {
        p.weaponLevel = 2;
        this.audio.upgrade();
        this.toast("ION LANCE ONLINE — DAMAGE AND FIRE RATE INCREASED", "gold", 4.4);
        this.floatText(p.x, p.y - 32, "ION LANCE", "#ffd166");
        this.particles.ring(p.x, p.y, "#ff9d3c", 70, 0.9);
        this.say("That prototype was never cleared for live fire. Neither were you.", 4, "AURORA");
        return true;
      }

      return true;
    }

    onBossDefeated() {
      if (this.bossDefeated) return;
      this.bossDefeated = true;
      this.kills += 1;
      this.escapeActive = true;
      this.escapeTimer = 90;
      this.lastBeep = 99;
      this.world.unlockAllDoors();
      this.setObjective("escape");
      this.audio.setMood("escape");
      this.audio.alarm();
      this.flash = 0.8;
      this.shake(18);
      this.toast("REACTOR CASCADE INITIATED — 90 SECONDS", "red", 5);
      this.say("AURORA: I only wanted someone to stay.", 4.4, "AURORA");
      this.say("ROOK: Not today. Move!", 2.6, "ROOK");
      this.spawnEscapeWave();
    }

    /* ============================ effects ============================ */

    shake(amount) {
      this.camera.shake = Math.min(30, Math.max(this.camera.shake, amount));
    }

    floatText(x, y, text, color) {
      this.texts.push({ x, y, text, color, life: 0.9, max: 0.9 });
    }

    say(text, duration, speaker) {
      let line = text;
      if (speaker && line.indexOf(speaker + ": ") === 0) {
        line = line.slice(speaker.length + 2);
      }
      const entry = {
        speaker: speaker || "SYSTEM",
        text: line,
        time: duration || 4,
        max: duration || 4,
      };
      if (this.dialog) this.dialogQueue.push(entry);
      else this.dialog = entry;
      if (this.dialogQueue.length > 5) this.dialogQueue.shift();
    }

    toast(text, tone, duration) {
      this.toasts.push({
        text,
        tone: tone || "cyan",
        time: duration || 3,
        max: duration || 3,
      });
      if (this.toasts.length > 4) this.toasts.shift();
    }

    explosion(x, y, radius, damage, color) {
      this.audio.explode(true);
      this.shake(16);
      this.flash = Math.min(1, this.flash + 0.4);
      this.particles.ring(x, y, color, radius * 1.15, 0.7);
      this.particles.burst(x, y, color, 34, {
        speedMax: 380,
        sizeMax: 4,
        lifeMax: 0.9,
      });
      this.particles.burst(x, y, "#6b7d8c", 14, {
        speedMax: 140,
        sizeMax: 6,
        lifeMax: 1.5,
        smoke: true,
      });

      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = VB.dist(x, y, e.x, e.y);
        if (d < radius + e.r) {
          const falloff = 1 - d / (radius + e.r);
          e.active = true;
          e.takeDamage(damage * falloff, this);
        }
      }

      if (this.boss && this.boss.active && !this.boss.dead) {
        const d = VB.dist(x, y, this.boss.x, this.boss.y);
        if (d < radius + this.boss.r) {
          const falloff = 1 - d / (radius + this.boss.r);
          this.boss.takeDamage(damage * falloff, this);
        }
      }

      const pl = this.player;
      if (pl && !pl.dead) {
        const d = VB.dist(x, y, pl.x, pl.y);
        if (d < radius + pl.r) {
          const falloff = 1 - d / (radius + pl.r);
          pl.takeDamage(damage * 0.75 * falloff, this);
        }
      }

      for (const bar of this.barrels) {
        if (bar.dead) continue;
        const d = VB.dist(x, y, bar.x, bar.y);
        if (d < radius * 0.95) {
          this.pendingBarrels.push({ bar, t: VB.rand(0.1, 0.28) });
        }
      }
    }

    /* ============================ input helpers ============================ */

    mouseWorld() {
      return {
        x: this.input.mouse.x + this.camera.x,
        y: this.input.mouse.y + this.camera.y,
      };
    }

    /* ============================ update ============================ */

    loop(now) {
      const dt = Math.min(0.033, Math.max(0.0005, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;

      if (this.state === "playing") {
        this.update(dt);
      } else if (this.state === "dead" || this.state === "victory") {
        this.particles.update(dt);
        this.updateTexts(dt);
        this.camera.shake = Math.max(0, this.camera.shake - dt * 65);
        this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
        this.flash = Math.max(0, this.flash - dt * 3);
        if (this.dialog) {
          this.dialog.time -= dt;
          if (this.dialog.time <= 0) this.dialog = this.dialogQueue.shift() || null;
        }
      }

      this.render();
      this.input.endFrame();
      requestAnimationFrame(this.loop);
    }

    update(dt) {
      this.runTime += dt;
      const p = this.player;
      if (!p || p.dead) return;

      this.touch.update(dt);
      p.update(dt, this);
      this.updateDoors(dt);

      for (const e of this.enemies) e.update(dt, this);
      if (this.boss) this.boss.update(dt, this);

      for (const b of this.playerBullets) b.update(dt, this);
      for (const b of this.enemyBullets) b.update(dt, this);
      this.playerBullets = this.playerBullets.filter((b) => !b.dead);
      this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
      this.enemies = this.enemies.filter((e) => !e.dead);

      for (const pk of this.pickups) pk.update(dt, this);
      this.pickups = this.pickups.filter((pk) => !pk.dead);

      if (this.pendingBarrels.length) {
        for (const item of this.pendingBarrels) {
          item.t -= dt;
          if (item.t <= 0 && !item.bar.dead) item.bar.takeDamage(999, this);
        }
        this.pendingBarrels = this.pendingBarrels.filter(
          (item) => item.t > 0 && !item.bar.dead
        );
      }

      this.particles.update(dt);
      this.updateTexts(dt);
      this.updateToasts(dt);
      this.updateDialog(dt);
      this.updateCamera(dt);
      this.updateDiscovery(dt);
      this.updateBossTrigger();
      this.updateEscape(dt);
      this.updateInteraction();
      this.updateMood(dt);

      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.1);
      this.flash = Math.max(0, this.flash - dt * 3);
      this.camera.shake = Math.max(0, this.camera.shake - dt * 65);
    }

    updateDoors(dt) {
      const p = this.player;
      for (const d of this.world.doors) {
        if (d.seal) {
          d.unlocked = false;
          d.progress = 0;
          continue;
        }
        if (this.escapeActive) {
          d.unlocked = true;
          d.progress = Math.min(1, d.progress + dt * 3);
          continue;
        }
        if (d.unlocked) {
          d.progress = Math.min(1, d.progress + dt * 3);
          continue;
        }
        const has = d.type === "cyan" ? p.keycards.cyan : p.keycards.gold;
        if (has && VB.circleRect(p.x, p.y, 112, d.x, d.y, d.w, d.h)) {
          d.unlocked = true;
          d.progress = 0;
          this.audio.gate();
          this.toast(
            d.type === "gold" ? "GOLD CLEARANCE ACCEPTED" : "CYAN CLEARANCE ACCEPTED",
            d.type === "gold" ? "gold" : "cyan",
            2.6
          );
          this.particles.ring(
            d.x + d.w / 2,
            d.y + d.h / 2,
            d.type === "gold" ? "#ffd166" : "#4ef4ff",
            56,
            0.6
          );
        }
      }
    }

    updateInteraction() {
      this.prompt = null;
      const p = this.player;
      const w = this.world;

      let term = null;
      let termDist = 80;
      for (const t of w.terminals) {
        const d = VB.dist(p.x, p.y, t.x, t.y);
        if (d < termDist) {
          termDist = d;
          term = t;
        }
      }

      if (term) {
        this.prompt = {
          text: "ACCESS DATA TERMINAL",
          key: true,
          action: "log",
          target: term,
        };
      } else {
        const airDist = VB.dist(p.x, p.y, w.airlock.x, w.airlock.y);
        if (airDist < 98) {
          if (this.bossDefeated) {
            this.prompt = {
              text: "LAUNCH KESTREL — ESCAPE",
              key: true,
              action: "launch",
            };
          } else {
            this.prompt = {
              text: "AIRLOCK SEALED BY AURORA",
              key: true,
              locked: true,
              action: "airlockLocked",
            };
          }
        } else {
          for (const d of w.doors) {
            if (d.unlocked || d.seal) continue;
            if (VB.circleRect(p.x, p.y, 105, d.x, d.y, d.w, d.h)) {
              this.prompt = {
                text: d.type === "cyan" ? "CYAN CLEARANCE REQUIRED" : "GOLD CLEARANCE REQUIRED",
                key: true,
                locked: true,
                action: "door",
                door: d,
              };
              break;
            }
          }
        }
      }

      if (this.prompt && this.input.hit("KeyE")) {
        if (this.prompt.action === "log") {
          this.openLog(this.prompt.target);
        } else if (this.prompt.action === "launch") {
          this.winGame();
        } else if (this.prompt.action === "airlockLocked") {
          this.toast("AURORA HAS SEALED THE STATION — SHUT DOWN THE CORE", "red", 3.4);
          this.audio.beep(false);
        } else if (this.prompt.action === "door") {
          const hint =
            this.prompt.door.type === "cyan"
              ? "CYAN CARD IS IN THE SECURITY WING"
              : "REACTOR KEY IS IN ENGINEERING";
          this.toast("BULKHEAD LOCKED — " + hint, "red", 3.4);
          this.audio.beep(false);
        }
      }
    }

    updateCamera(dt, snap) {
      const p = this.player;
      const w = this.world;
      if (!p || !w) return;
      const lookX = (this.input.mouse.x - this.width / 2) * 0.055;
      const lookY = (this.input.mouse.y - this.height / 2) * 0.055;
      let tx = p.x - this.width / 2 + lookX;
      let ty = p.y - this.height / 2 + lookY;

      let cx;
      let cy;
      if (this.width >= w.pw) cx = (w.pw - this.width) / 2;
      else cx = VB.clamp(tx, 0, w.pw - this.width);
      if (this.height >= w.ph) cy = (w.ph - this.height) / 2;
      else cy = VB.clamp(ty, 0, w.ph - this.height);

      if (snap) {
        this.camera.x = cx;
        this.camera.y = cy;
      } else {
        this.camera.x = VB.damp(this.camera.x, cx, 7.5, dt);
        this.camera.y = VB.damp(this.camera.y, cy, 7.5, dt);
      }
    }

    updateDiscovery(dt) {
      const p = this.player;
      const room = this.world.roomAt(p.x, p.y);
      if (room && !room.discovered) {
        room.discovered = true;
        this.toast("ENTERING " + room.name, "cyan", 2.2);
        this.audio.ui();
      }
      this.revealTimer -= dt;
      if (this.revealTimer <= 0) {
        this.revealTimer = 0.14;
        this.world.revealAt(p.x, p.y, 7);
      }
    }

    updateBossTrigger() {
      if (!this.boss || this.boss.active || this.bossDefeated) return;
      const room = this.world.roomAt(this.player.x, this.player.y);
      if (room && room.id === "bridge") {
        this.boss.activate(this);
        const door = this.world.doorById("bridge");
        if (door) {
          door.seal = true;
          door.unlocked = false;
        }
        this.audio.setMood("boss");
        this.say("You should have stayed in the dark, scavenger.", 4.4, "AURORA");
        this.toast("AI CORE SEALED — NO EXIT", "red", 3.6);
      }
    }

    updateEscape(dt) {
      if (!this.escapeActive) return;
      const before = Math.ceil(this.escapeTimer);
      this.escapeTimer -= dt;
      const after = Math.ceil(this.escapeTimer);
      if (after !== before) {
        if (after === 30) this.toast("30 SECONDS", "red", 2.2);
        if (after > 0 && after <= 10) this.audio.beep(after % 2 === 0);
      }
      if (this.escapeTimer <= 0) {
        this.escapeTimer = 0;
        if (this.state === "playing") {
          this.onPlayerDeath("Nova-9 was consumed by the star.");
        }
      }
    }

    updateMood(dt) {
      this.moodTimer -= dt;
      if (this.moodTimer > 0) return;
      this.moodTimer = 0.4;
      let mood = "calm";
      if (this.escapeActive) mood = "escape";
      else if (this.boss && this.boss.active && !this.boss.dead) mood = "boss";
      else if (
        this.enemies.some(
          (e) =>
            !e.dead &&
            e.active &&
            VB.dist(e.x, e.y, this.player.x, this.player.y) < 700
        )
      ) {
        mood = "combat";
      }
      this.audio.setMood(mood);
    }

    updateTexts(dt) {
      for (const t of this.texts) {
        t.life -= dt;
        t.y -= dt * 26;
      }
      this.texts = this.texts.filter((t) => t.life > 0);
    }

    updateToasts(dt) {
      for (const t of this.toasts) t.time -= dt;
      this.toasts = this.toasts.filter((t) => t.time > 0);
    }

    updateDialog(dt) {
      if (!this.dialog) {
        this.introLock = false;
        return;
      }
      this.dialog.time -= dt;
      if (this.dialog.time <= 0) {
        this.dialog = this.dialogQueue.shift() || null;
        if (!this.dialog) this.introLock = false;
      }
    }

    /* ============================ rendering ============================ */

    render() {
      const g = this.ctx;
      const W = this.width;
      const H = this.height;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      if (this.state === "title" || !this.world || !this.player) {
        this.renderTitleBg(g);
        return;
      }

      const shakeX = (Math.random() * 2 - 1) * this.camera.shake * 0.5;
      const shakeY = (Math.random() * 2 - 1) * this.camera.shake * 0.5;
      this.viewX = this.camera.x + shakeX;
      this.viewY = this.camera.y + shakeY;

      g.fillStyle = "#02040a";
      g.fillRect(0, 0, W, H);

      g.save();
      g.translate(-this.viewX, -this.viewY);

      this.world.drawStatic(g, { x: this.viewX, y: this.viewY }, W, H);
      this.world.drawDoors(g, this.time);
      this.world.drawTerminals(g, this.time, this.player);
      this.world.drawAirlock(g, this.time, this.bossDefeated);

      for (const b of this.barrels) b.draw(g, this);
      for (const pk of this.pickups) pk.draw(g, this);
      for (const e of this.enemies) e.draw(g, this);
      if (this.boss) this.boss.draw(g, this);
      if (!this.player.dead) this.player.draw(g, this);
      for (const b of this.playerBullets) b.draw(g);
      for (const b of this.enemyBullets) b.draw(g);
      this.particles.draw(g);
      this.drawTexts(g);

      g.restore();

      this.renderLighting();
      this.drawGlowPass();
      this.drawScreenFX();

      if (this.state !== "dead" && this.state !== "victory") {
        VB.drawWaypoint(g, this);
        VB.drawHUD(g, this);
        VB.drawCrosshair(g, this);
        if (this.touchMode) this.touch.draw(g);
      }
    }

    drawTexts(g) {
      for (const t of this.texts) {
        const a = Math.max(0, t.life / t.max);
        g.save();
        g.globalAlpha = a;
        g.font = '700 11px "Consolas",monospace';
        g.textAlign = "center";
        g.lineWidth = 3;
        g.strokeStyle = "rgba(2,6,12,0.8)";
        g.strokeText(t.text, t.x, t.y);
        g.fillStyle = t.color;
        g.fillText(t.text, t.x, t.y);
        g.restore();
      }
    }

    renderLighting() {
      const g = this.ctx;
      const lc = this.lightCtx;
      const W = this.width;
      const H = this.height;
      if (this.lightCanvas.width !== W || this.lightCanvas.height !== H) {
        this.lightCanvas.width = W;
        this.lightCanvas.height = H;
      }

      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, W, H);
      lc.fillStyle = "rgba(2,5,13,0.56)";
      lc.fillRect(0, 0, W, H);
      lc.globalCompositeOperation = "destination-out";

      const p = this.player;
      const px = p.x - this.viewX;
      const py = p.y - this.viewY;
      this.punchLight(lc, px, py, 300, 1);

      const m = this.input.mouse;
      const aimX = px + (m.x - W / 2) * 0.5;
      const aimY = py + (m.y - H / 2) * 0.5;
      this.punchLight(lc, aimX, aimY, 150, 0.55);

      for (const L of this.world.lights) {
        const x = L.x - this.viewX;
        const y = L.y - this.viewY;
        if (x < -L.r || x > W + L.r || y < -L.r || y > H + L.r) continue;
        this.punchLight(lc, x, y, L.r, L.str * 0.75);
      }

      // muzzle / explosion flashes push light out briefly
      if (this.flash > 0) {
        lc.globalCompositeOperation = "source-over";
        lc.globalAlpha = Math.min(0.2, this.flash * 0.2);
        lc.fillStyle = "#000";
        lc.fillRect(0, 0, W, H);
        lc.globalAlpha = 1;
      }

      lc.globalCompositeOperation = "source-over";
      g.drawImage(this.lightCanvas, 0, 0, W, H);
    }

    punchLight(lc, x, y, r, strength) {
      if (r <= 0) return;
      const grad = lc.createRadialGradient(x, y, r * 0.05, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${0.94 * strength})`);
      grad.addColorStop(0.45, `rgba(0,0,0,${0.7 * strength})`);
      grad.addColorStop(0.78, `rgba(0,0,0,${0.25 * strength})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      lc.fillStyle = grad;
      lc.beginPath();
      lc.arc(x, y, r, 0, TAU);
      lc.fill();
    }

    drawGlowPass() {
      const g = this.ctx;
      const W = this.width;
      const H = this.height;
      const p = this.player;
      g.save();
      g.globalCompositeOperation = "lighter";

      const px = p.x - this.viewX;
      const py = p.y - this.viewY;
      let grd = g.createRadialGradient(px, py, 2, px, py, 64);
      grd.addColorStop(0, "rgba(78,244,255,0.10)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(px, py, 64, 0, TAU);
      g.fill();

      for (const L of this.world.lights) {
        const x = L.x - this.viewX;
        const y = L.y - this.viewY;
        if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
        grd = g.createRadialGradient(x, y, 2, x, y, L.r * 0.9);
        grd.addColorStop(0, this.alphaColor(L.color, 0.028 * L.str));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, L.r * 0.9, 0, TAU);
        g.fill();
      }

      for (const pk of this.pickups) {
        if (pk.dead) continue;
        const x = pk.x - this.viewX;
        const y = pk.y - this.viewY;
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
        grd = g.createRadialGradient(x, y, 2, x, y, 40);
        grd.addColorStop(0, this.alphaColor(pk.color, 0.14));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, 40, 0, TAU);
        g.fill();
      }

      for (const b of this.playerBullets) {
        const x = b.x - this.viewX;
        const y = b.y - this.viewY;
        grd = g.createRadialGradient(x, y, 1, x, y, 22);
        grd.addColorStop(0, this.alphaColor(b.color, 0.28));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, 22, 0, TAU);
        g.fill();
      }
      for (const b of this.enemyBullets) {
        const x = b.x - this.viewX;
        const y = b.y - this.viewY;
        grd = g.createRadialGradient(x, y, 1, x, y, 20);
        grd.addColorStop(0, this.alphaColor(b.color, 0.24));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, 20, 0, TAU);
        g.fill();
      }

      if (this.boss && this.boss.active && !this.boss.dead) {
        const x = this.boss.x - this.viewX;
        const y = this.boss.y - this.viewY;
        grd = g.createRadialGradient(x, y, 10, x, y, 190);
        grd.addColorStop(0, "rgba(255,69,216,0.10)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, 190, 0, TAU);
        g.fill();
      }

      g.restore();
    }

    alphaColor(hex, alpha) {
      if (!hex || hex[0] !== "#") return `rgba(78,244,255,${alpha})`;
      let h = hex.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const n = parseInt(h, 16);
      const r = (n >> 16) & 255;
      const gg = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r},${gg},${b},${alpha})`;
    }

    drawScreenFX() {
      const g = this.ctx;
      const W = this.width;
      const H = this.height;
      const p = this.player;

      if (this.damageFlash > 0) {
        const a = this.damageFlash * 0.42;
        const grd = g.createRadialGradient(
          W / 2,
          H / 2,
          Math.min(W, H) * 0.22,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.72
        );
        grd.addColorStop(0, "rgba(255,40,60,0)");
        grd.addColorStop(0.7, `rgba(255,40,60,${a * 0.4})`);
        grd.addColorStop(1, `rgba(255,40,60,${a})`);
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
      }

      if (p && p.hp / p.maxHp < 0.34 && this.state === "playing") {
        const pulse = 0.5 + Math.sin(this.time * 5.2) * 0.5;
        const a = 0.1 + pulse * 0.14;
        const grd = g.createRadialGradient(
          W / 2,
          H / 2,
          Math.min(W, H) * 0.3,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.7
        );
        grd.addColorStop(0, "rgba(255,20,45,0)");
        grd.addColorStop(1, `rgba(255,20,45,${a})`);
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
      }

      if (this.boss && this.boss.active && !this.boss.dead) {
        const grd = g.createRadialGradient(
          W / 2,
          H / 2,
          Math.min(W, H) * 0.34,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.72
        );
        grd.addColorStop(0, "rgba(255,69,216,0)");
        grd.addColorStop(1, "rgba(255,69,216,0.09)");
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
      }

      if (this.escapeActive) {
        const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
        const grd = g.createRadialGradient(
          W / 2,
          H / 2,
          Math.min(W, H) * 0.36,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.72
        );
        grd.addColorStop(0, "rgba(255,30,50,0)");
        grd.addColorStop(1, `rgba(255,30,50,${0.05 + pulse * 0.09})`);
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
      }

      if (this.flash > 0) {
        g.fillStyle = `rgba(255,245,255,${this.flash * 0.22})`;
        g.fillRect(0, 0, W, H);
      }
    }

    /* ============================ title backdrop ============================ */

    renderTitleBg(g) {
      const W = this.width;
      const H = this.height;
      const t = this.time;

      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#02040b");
      bg.addColorStop(0.6, "#040a16");
      bg.addColorStop(1, "#02050b");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      let grd = g.createRadialGradient(W * 0.76, H * 0.32, 0, W * 0.76, H * 0.32, W * 0.5);
      grd.addColorStop(0, "rgba(255,69,216,0.06)");
      grd.addColorStop(0.6, "rgba(80,40,140,0.035)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);

      grd = g.createRadialGradient(W * 0.35, H * 0.7, 0, W * 0.35, H * 0.7, W * 0.42);
      grd.addColorStop(0, "rgba(35,140,180,0.055)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);

      // stars
      for (const s of this.titleStars) {
        const x = (((s.x * W + t * s.drift * s.z) % W) + W) % W;
        const y = s.y * H;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.6 + s.z) + s.tw));
        g.globalAlpha = tw * (0.25 + s.z * 0.65);
        g.fillStyle = s.z > 0.75 ? "#d8f6ff" : "#8fbdd8";
        g.fillRect(x, y, s.z * 1.8, s.z * 1.8);
      }
      g.globalAlpha = 1;

      // shooting star loop
      const cycle = (t % 9) / 9;
      if (cycle < 0.12) {
        const prog = cycle / 0.12;
        const sx = W * 0.42 + prog * W * 0.4;
        const sy = H * 0.12 + prog * H * 0.28;
        const grad = g.createLinearGradient(sx - 130, sy - 40, sx, sy);
        grad.addColorStop(0, "rgba(160,240,255,0)");
        grad.addColorStop(1, "rgba(190,250,255,0.8)");
        g.strokeStyle = grad;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(sx - 130, sy - 40);
        g.lineTo(sx, sy);
        g.stroke();
      }

      this.drawTitlePlanet(g, W * 0.8, H * 0.63, Math.min(W, H) * 0.32, t);
      this.drawTitleStation(g, W * 0.63, H * 0.28, Math.min(W, H) / 850, t);

      const fog = g.createLinearGradient(0, H * 0.62, 0, H);
      fog.addColorStop(0, "rgba(2,5,12,0)");
      fog.addColorStop(1, "rgba(2,4,9,0.9)");
      g.fillStyle = fog;
      g.fillRect(0, H * 0.6, W, H * 0.4);
    }

    drawTitlePlanet(g, cx, cy, r, t) {
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.32);

      g.strokeStyle = "rgba(255,120,200,0.13)";
      g.lineWidth = r * 0.1;
      g.beginPath();
      g.ellipse(0, 0, r * 1.6, r * 0.4, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = "rgba(120,230,255,0.08)";
      g.lineWidth = r * 0.03;
      g.beginPath();
      g.ellipse(0, 0, r * 1.8, r * 0.46, 0, 0, TAU);
      g.stroke();

      const pg = g.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.06, 0, 0, r);
      pg.addColorStop(0, "#3c2747");
      pg.addColorStop(0.45, "#1b1227");
      pg.addColorStop(0.82, "#0a0612");
      pg.addColorStop(1, "#040207");
      g.fillStyle = pg;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();

      g.globalCompositeOperation = "lighter";
      const rim = g.createRadialGradient(-r * 0.5, -r * 0.5, r * 0.2, 0, 0, r);
      rim.addColorStop(0, "rgba(255,120,200,0.12)");
      rim.addColorStop(0.55, "rgba(100,80,190,0.05)");
      rim.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rim;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();

      g.strokeStyle = "rgba(255,140,220,0.35)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, r - 1, -2.3, -0.5);
      g.stroke();
      g.restore();
    }

    drawTitleStation(g, x, y, s, t) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.22);
      g.scale(s, s);
      g.globalAlpha = 0.92;

      const hull = "#081420";
      const edge = "rgba(120,210,240,0.28)";
      g.strokeStyle = edge;
      g.lineWidth = 1.2;
      g.fillStyle = hull;

      // main spine
      g.fillRect(-235, -7, 470, 14);
      g.strokeRect(-235, -7, 470, 14);

      // habitat rings
      for (const ox of [-188, -120, 118, 182]) {
        g.beginPath();
        g.arc(ox, 0, 18, 0, TAU);
        g.fillStyle = "#0a1a28";
        g.fill();
        g.strokeStyle = edge;
        g.stroke();
        g.beginPath();
        g.arc(ox, 0, 25, 0, TAU);
        g.strokeStyle = "rgba(120,210,240,0.14)";
        g.stroke();
      }

      // central core block
      g.fillStyle = "#0b1e2d";
      g.fillRect(-33, -28, 66, 56);
      g.strokeStyle = edge;
      g.strokeRect(-33, -28, 66, 56);
      g.beginPath();
      g.arc(0, 0, 15, 0, TAU);
      g.strokeStyle = "rgba(78,244,255,0.5)";
      g.stroke();

      // solar arrays
      g.strokeStyle = "rgba(100,190,220,0.24)";
      g.fillStyle = "rgba(14,40,58,0.55)";
      for (const dir of [-1, 1]) {
        const bx = dir * 33;
        g.beginPath();
        g.moveTo(bx, -26);
        g.lineTo(bx + dir * 62, -62);
        g.lineTo(bx + dir * 62, -14);
        g.lineTo(bx, 0);
        g.closePath();
        g.fill();
        g.stroke();
      }

      // antenna
      g.strokeStyle = "rgba(150,220,245,0.35)";
      g.beginPath();
      g.moveTo(0, -28);
      g.lineTo(0, -92);
      g.stroke();

      const blink = 0.5 + Math.sin(t * 3.4) * 0.5;
      g.fillStyle = `rgba(255,69,216,${0.3 + blink * 0.7})`;
      g.shadowColor = "#ff45d8";
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(0, -92, 2.2, 0, TAU);
      g.fill();
      g.shadowBlur = 0;

      // running lights
      for (let i = 0; i < 18; i++) {
        const ox = -222 + i * 26;
        const on = Math.sin(t * 2 + i * 1.7) > 0.2;
        g.fillStyle = on
          ? i % 5 === 0
            ? "rgba(255,69,216,0.85)"
            : "rgba(78,244,255,0.8)"
          : "rgba(30,70,90,0.5)";
        g.fillRect(ox, -2, 2.4, 2.4);
      }

      g.restore();
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (!window.__VOIDBREAK__) new Game();
  });

  if (document.readyState !== "loading" && !window.__VOIDBREAK__) {
    new Game();
  }
})();
