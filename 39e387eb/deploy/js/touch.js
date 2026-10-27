(function () {
  "use strict";
  const VB = window.VB;
  const TAU = VB.TAU;

  function safeInsets() {
    let el = document.getElementById("safe-probe");
    if (!el) {
      el = document.createElement("div");
      el.id = "safe-probe";
      el.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
        "padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);" +
        "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);";
      document.body.appendChild(el);
    }
    const cs = window.getComputedStyle(el);
    return {
      left: parseFloat(cs.paddingLeft) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      top: parseFloat(cs.paddingTop) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
    };
  }

  class TouchControls {
    constructor(game) {
      this.game = game;
      this.active = false;
      this.pointers = new Map();
      this.move = null;
      this.aim = null;
      this.aimAngle = 0;
      this.aimInit = false;
      this.geo = null;
      this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
      this.dead = 10;
      this.forced = /[?&]touch=1/.test(location.search);
      this.bind();
    }

    static get supported() {
      const touchPrimary =
        window.matchMedia && window.matchMedia("(pointer: coarse) and (hover: none)").matches;
      const forced = /[?&]touch=1/.test(location.search);
      return touchPrimary || forced;
    }

    bind() {
      const canvas = this.game.canvas;
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (!this.active) return;
          e.preventDefault();
          this.onDown(e);
        },
        { passive: false }
      );
      window.addEventListener(
        "pointermove",
        (e) => {
          if (!this.active) return;
          this.onMove(e);
        },
        { passive: false }
      );
      const up = (e) => this.onUp(e);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);

      if (!this.forced) {
        window.addEventListener(
          "pointerdown",
          (e) => {
            if (e.pointerType === "touch" || e.pointerType === "pen") this.enable();
          },
          true
        );
        const toKeyboard = () => {
          if (this.active && !this.forced) this.disable();
        };
        window.addEventListener("mousemove", toKeyboard, true);
        window.addEventListener("keydown", toKeyboard, true);
      }
    }

    enable() {
      if (this.active) return;
      this.active = true;
      this.game.touchMode = true;
      this.game.input.touch.enabled = true;
      this.measure();
    }

    disable() {
      this.active = false;
      this.game.touchMode = false;
      this.game.input.touch.enabled = false;
      this.releaseAll();
    }

    measure() {
      const g = this.game;
      const W = g.width;
      const H = g.height;
      this.insets = safeInsets();
      const s = this.insets;
      const scale = VB.clamp(Math.min(W, H) / 400, 0.85, 1.15);
      const r = 52 * scale;
      const br = 29 * scale;
      const m = 20;
      const aimX = W - s.right - m - r;
      const aimY = H - s.bottom - m - r;
      const side = aimX - (r + br + 14);
      this.geo = {
        scale,
        r,
        br,
        aimReach: 150 * scale,
        moveHome: { x: s.left + m + r, y: H - s.bottom - m - r },
        aimHome: { x: aimX, y: aimY },
        dash: { x: side, y: aimY + r * 0.34 },
        act: { x: side, y: aimY - r * 0.9 },
        pause: { x: W - s.right - 26, y: s.top + 26 },
      };
    }

    releaseAll() {
      this.pointers.clear();
      this.move = null;
      this.aim = null;
      const t = this.game.input.touch;
      t.x = 0;
      t.y = 0;
      t.fire = false;
    }

    inCircle(x, y, c, pad) {
      const r = (this.geo.br || 30) + (pad || 0);
      return (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) <= r * r;
    }

    onDown(e) {
      const g = this.game;
      if (g.state !== "playing") return;
      const x = e.clientX;
      const y = e.clientY;
      const geo = this.geo;

      if (this.inCircle(x, y, geo.pause, 8)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        g.pause();
        return;
      }
      if (this.inCircle(x, y, geo.dash, 6)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        g.input.pressed.add("ShiftLeft");
        return;
      }
      if (g.prompt && this.inCircle(x, y, geo.act, 6)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        g.input.pressed.add("KeyE");
        return;
      }

      if (x < g.width * 0.5) {
        if (this.move) return;
        this.move = { ox: x, oy: y, x, y };
        this.pointers.set(e.pointerId, { role: "move" });
      } else {
        if (this.aim) return;
        this.aim = { ox: x, oy: y, x, y };
        this.pointers.set(e.pointerId, { role: "aim" });
        g.input.touch.fire = true;
      }
    }

    onMove(e) {
      const p = this.pointers.get(e.pointerId);
      if (!p || p.role === "ui") return;
      const stick = p.role === "move" ? this.move : this.aim;
      if (!stick) return;
      stick.x = e.clientX;
      stick.y = e.clientY;
    }

    onUp(e) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (p.role === "move") {
        this.move = null;
        this.game.input.touch.x = 0;
        this.game.input.touch.y = 0;
      } else if (p.role === "aim") {
        this.aim = null;
        this.game.input.touch.fire = false;
      }
    }

    update(dt) {
      const g = this.game;
      if (!this.active) return;
      if (g.state !== "playing") {
        this.releaseAll();
        return;
      }
      this.measure();

      const geo = this.geo;
      const r = geo.r;
      const t = g.input.touch;

      if (this.move) {
        let dx = this.move.x - this.move.ox;
        let dy = this.move.y - this.move.oy;
        const len = Math.hypot(dx, dy);
        if (len < this.dead) {
          dx = 0;
          dy = 0;
        } else {
          const k = Math.min(1, (len - this.dead) / (r - this.dead));
          dx = (dx / len) * k;
          dy = (dy / len) * k;
        }
        t.x = dx;
        t.y = dy;
      }

      if (this.aim) {
        const dx = this.aim.x - this.aim.ox;
        const dy = this.aim.y - this.aim.oy;
        if (Math.hypot(dx, dy) > this.dead) this.aimAngle = Math.atan2(dy, dx);
        this.aimInit = true;
      }

      if (g.player) {
        if (!this.aimInit) {
          const dx = g.input.mouse.x - (g.player.x - g.camera.x);
          const dy = g.input.mouse.y - (g.player.y - g.camera.y);
          if (Math.hypot(dx, dy) > 4) this.aimAngle = Math.atan2(dy, dx);
          this.aimInit = true;
        }
        const px = g.player.x - g.camera.x;
        const py = g.player.y - g.camera.y;
        g.input.mouse.x = px + Math.cos(this.aimAngle) * geo.aimReach;
        g.input.mouse.y = py + Math.sin(this.aimAngle) * geo.aimReach;
      }
    }

    /* ---------------------------- rendering ---------------------------- */

    draw(g) {
      if (!this.active || !this.geo) return;
      const game = this.game;
      if (game.state !== "playing") return;
      const geo = this.geo;
      const ctx = g;

      ctx.save();
      this.drawStick(ctx, geo.moveHome, this.move, geo.r, "#4ef4ff", "MOVE");
      this.drawStick(
        ctx,
        geo.aimHome,
        this.aim,
        geo.r,
        this.aim ? "#ff9d3c" : "#ff45d8",
        "AIM / FIRE"
      );
      this.drawButton(ctx, geo.dash, "DASH", game.player && game.player.dashCooldown > 0, "#9dfaff");
      if (game.prompt) {
        this.drawButton(
          ctx,
          geo.act,
          game.prompt.locked ? "LOCK" : "USE",
          false,
          game.prompt.locked ? "#ff8b9b" : "#4ef4ff"
        );
      }
      this.drawPause(ctx, geo.pause);
      ctx.restore();
    }

    drawStick(ctx, home, stick, r, color, label) {
      const ox = stick ? stick.ox : home.x;
      const oy = stick ? stick.oy : home.y;
      const live = !!stick;
      ctx.save();
      ctx.globalAlpha = live ? 0.95 : 0.3;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = live ? 0.16 : 0.05;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.fill();

      if (live) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(2,8,14,0.9)";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ox, oy, r * 0.44, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(stick.x, stick.y);
        ctx.stroke();
      }

      if (!live) {
        ctx.globalAlpha = 0.42;
        ctx.font = '700 8px "Consolas",monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.fillText(label, home.x, home.y + r + 14);
      }
      ctx.restore();
    }

    drawButton(ctx, c, label, dim, color) {
      const r = this.geo.br;
      const tone = color || "#9dfaff";
      ctx.save();
      ctx.globalAlpha = dim ? 0.3 : 0.92;
      ctx.fillStyle = "rgba(3,12,20,0.72)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = tone;
      ctx.font = '700 9px "Consolas",monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, c.x, c.y + 3.5);
      ctx.restore();
    }

    drawPause(ctx, c) {
      const r = 17;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(3,12,20,0.8)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(78,244,255,0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "#bff3ff";
      ctx.fillRect(c.x - 4.5, c.y - 6, 3, 12);
      ctx.fillRect(c.x + 1.5, c.y - 6, 3, 12);
      ctx.restore();
    }
  }

  VB.TouchControls = TouchControls;
})();
