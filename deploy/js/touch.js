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
      this.skillPress = false;
      this.ultPress = false;
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
        skill: { x: W - s.right - m - br - (br + 10) * 2, y: aimY - r * 2.3 },
        ult: { x: W - s.right - m - br, y: aimY - r * 2.3 },
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
      if (this.inCircle(x, y, geo.ult, 8)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        this.ultPress = true;
        return;
      }
      if (this.inCircle(x, y, geo.skill, 8)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        this.skillPress = true;
        return;
      }
      if (g.prompt && this.inCircle(x, y, geo.act, 6)) {
        this.pointers.set(e.pointerId, { role: "ui" });
        g.input.pressed.add("KeyE");
        return;
      }

      if (x < g.width * 0.5) {
        if (this.move) return;
        const o = this.stickOrigin(geo.moveHome, x, y, geo.r);
        this.move = { ox: o.ox, oy: o.oy, x, y, fixed: o.fixed };
        this.pointers.set(e.pointerId, { role: "move" });
      } else {
        if (this.aim) return;
        const o = this.stickOrigin(geo.aimHome, x, y, geo.r);
        this.aim = { ox: o.ox, oy: o.oy, x, y, fixed: o.fixed };
        this.pointers.set(e.pointerId, { role: "aim" });
        g.input.touch.fire = true;
      }
    }

    /* A press on or near the printed ring locks the stick to it so the knob
       can sweep the full circle; a press elsewhere drops a floating stick. */
    stickOrigin(home, x, y, r) {
      if (Math.hypot(x - home.x, y - home.y) <= r * 1.85) {
        return { ox: home.x, oy: home.y, fixed: true };
      }
      return { ox: x, oy: y, fixed: false };
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
        "AIM / FIRE",
        true
      );
      this.drawButton(ctx, geo.dash, "DASH", game.player && game.player.dashCooldown > 0, "#9dfaff");
      const p = game.player;
      if (p && p.skill) {
        this.drawAbility(
          ctx,
          geo.skill,
          p.skill,
          "Q",
          1 - Math.min(1, p.skillCd / Math.max(0.001, p.skillCdMax)),
          p.accent
        );
        this.drawAbility(
          ctx,
          geo.ult,
          p.ultDef,
          "R",
          p.ultCharge / p.ultMax,
          p.ultCharge >= p.ultMax ? "#ffd166" : p.accent
        );
      }
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

    drawStick(ctx, home, stick, r, color, label, showDeg) {
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

      this.drawDial(ctx, ox, oy, r, color, live);

      if (live) {
        const vx = stick.x - ox;
        const vy = stick.y - oy;
        const len = Math.hypot(vx, vy);
        const ang = Math.atan2(vy, vx);
        const clamp = len > r ? r / len : 1;
        const kx = ox + vx * clamp;
        const ky = oy + vy * clamp;

        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(kx, ky);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.strokeStyle = "rgba(2,8,14,0.9)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(kx, ky, r * 0.36, 0, TAU);
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(ox, oy, r * 0.14, 0, TAU);
        ctx.fill();

        if (len > this.dead) this.drawHeading(ctx, ox, oy, r, ang, color);
        if (showDeg) {
          const deg = Math.round(((ang * 180) / Math.PI + 360) % 360);
          ctx.globalAlpha = 0.95;
          ctx.font = '700 9px "Consolas",monospace';
          ctx.textAlign = "center";
          ctx.fillStyle = color;
          ctx.fillText(deg + "\u00b0", ox, oy + r + 15);
        }
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

    /* Compass ring: 24 tick marks so the stick reads as a full circle. */
    drawDial(ctx, ox, oy, r, color, live) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let a = 0; a < 360; a += 15) {
        const cardinal = a % 90 === 0;
        ctx.globalAlpha = (cardinal ? 0.5 : 0.2) * (live ? 1 : 0.8);
        const rad = (a * Math.PI) / 180;
        const inner = r - (cardinal ? 9 : 5);
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(rad) * inner, oy + Math.sin(rad) * inner);
        ctx.lineTo(ox + Math.cos(rad) * (r - 1.5), oy + Math.sin(rad) * (r - 1.5));
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Needle plus trailing sweep at the live bearing. */
    drawHeading(ctx, ox, oy, r, ang, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(ox, oy, r - 4, ang - 0.55, ang);
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = color;
      const px = ox + Math.cos(ang) * (r - 1);
      const py = oy + Math.sin(ang) * (r - 1);
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-3, 4.6);
      ctx.lineTo(-3, -4.6);
      ctx.closePath();
      ctx.fill();
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

    /* Ability buttons carry their own state: the ring fills as a cooldown
       recharges or an ultimate charges, so no separate meter is needed. */
    drawAbility(ctx, c, def, key, frac, color) {
      const r = this.geo.br;
      const ready = frac >= 1;
      ctx.save();
      ctx.globalAlpha = ready ? 0.96 : 0.7;
      ctx.fillStyle = "rgba(3,12,20,0.74)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.fill();

      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(80,120,140,0.3)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = ready ? color : "rgba(150,200,220,0.7)";
      if (ready) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * VB.clamp(frac, 0, 1));
      ctx.stroke();
      ctx.shadowBlur = 0;

      const tone = ready ? color : "#7695a6";
      if (VB.abilityGlyph) {
        VB.abilityGlyph(ctx, c.x, c.y, def.type, tone, 1);
      } else {
        ctx.fillStyle = tone;
        ctx.font = '700 11px "Consolas",monospace';
        ctx.textAlign = "center";
        ctx.fillText(key, c.x, c.y + 4);
      }

      ctx.fillStyle = ready ? tone : "#7695a6";
      ctx.font = '700 8px "Consolas",monospace';
      ctx.textAlign = "center";
      ctx.fillText(key, c.x - r + 5, c.y - r + 5);
      ctx.font = '700 7px "Consolas",monospace';
      ctx.fillText(def.name, c.x, c.y + r + 10);
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
  VB.stage && VB.stage("link");
})();
