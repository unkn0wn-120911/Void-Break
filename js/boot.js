(function () {
  "use strict";
  const VB = window.VB;

  const STAGES = [
    { id: "core", text: "VOID CORE MOUNTED" },
    { id: "input", text: "INPUT MATRIX CALIBRATED" },
    { id: "audio", text: "AUDIO SUBSYSTEM WARMED" },
    { id: "world", text: "STATION BLUEPRINT GENERATED" },
    { id: "crew", text: "CREW MANIFEST DECODED" },
    { id: "hud", text: "HUD PLATES ASSEMBLED" },
    { id: "link", text: "TOUCH LINK PAIRED" },
  ];

  const MIN_VISIBLE = 1150;
  const WATCHDOG = 6000;

  /* The bar chases the real milestones, but it also creeps on its own and a
     watchdog forces it closed, so a stalled script can never trap the player
     on the loading screen. */
  class Boot {
    constructor() {
      this.el = document.getElementById("screen-boot");
      this.fill = document.getElementById("boot-fill");
      this.pct = document.getElementById("boot-pct");
      this.stage = document.getElementById("boot-stage");
      this.logEl = document.getElementById("boot-log");

      this.progress = 0;
      this.target = 0;
      this.marked = 0;
      this.finished = false;
      this.hidden = false;
      this.started = performance.now();
      this.lastT = this.started;

      if (!this.el) return;
      this.tick = this.tick.bind(this);
      requestAnimationFrame(this.tick);
      setTimeout(() => this.finish(true), WATCHDOG);

      const skip = () => this.finish(true);
      window.addEventListener("keydown", skip);
      window.addEventListener("pointerdown", skip);
    }

    mark(id) {
      if (this.hidden || this.finished) return;
      const i = STAGES.findIndex((s) => s.id === id);
      if (i < 0 || i < this.marked) return;
      this.marked = i + 1;
      this.target = this.marked / STAGES.length;
      if (this.stage) this.stage.textContent = STAGES[i].text;
      this.log(STATES_TEXT[i]);
      if (this.marked >= STAGES.length) this.finish(false);
    }

    log(line) {
      if (!this.logEl) return;
      const row = document.createElement("div");
      row.className = "boot-line";
      row.textContent = line;
      this.logEl.appendChild(row);
      while (this.logEl.childNodes.length > 5) {
        this.logEl.removeChild(this.logEl.firstChild);
      }
    }

    finish(force) {
      if (this.finished) {
        if (force) this.hide();
        return;
      }
      this.finished = true;
      this.target = 1;
      const wait = force ? 130 : Math.max(130, MIN_VISIBLE - (performance.now() - this.started));
      setTimeout(() => this.hide(), wait);
    }

    hide() {
      if (this.hidden || !this.el) return;
      this.hidden = true;
      this.progress = 1;
      this.paint();
      this.el.classList.add("boot-out");
      setTimeout(() => {
        this.el.classList.remove("active");
      }, 460);
    }

    tick() {
      if (this.hidden) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      if (this.finished) {
        this.progress = Math.min(1, this.progress + dt * 3.2);
      } else {
        const chase = (this.target - this.progress) * 0.16;
        this.progress = Math.min(0.97, this.progress + Math.max(dt * 0.045, chase));
      }
      this.paint();
      requestAnimationFrame(this.tick);
    }

    paint() {
      const p = VB.clamp(this.progress, 0, 1);
      if (this.fill) this.fill.style.width = (p * 100).toFixed(1) + "%";
      if (this.pct) this.pct.textContent = String(Math.floor(p * 100)).padStart(2, "0") + "%";
    }
  }

  const STATES_TEXT = STAGES.map((s) => "> " + s.text.toLowerCase() + " ......... ok");

  VB.boot = new Boot();
  VB.boot.mark("core");

  // Every later script calls this once at the end of its file.
  VB.stage = function (id) {
    if (VB.boot) VB.boot.mark(id);
  };
})();
