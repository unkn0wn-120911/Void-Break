(function () {
  "use strict";
  const VB = window.VB;
  const T = VB.TILE;
  const TAU = VB.TAU;

  /* ============================ PARTICLES ============================ */

  class Particles {
    constructor() {
      this.list = [];
      this.max = 850;
    }

    add(p) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push(p);
    }

    burst(x, y, color, count, opts) {
      const o = opts || {};
      const speedMin = o.speedMin == null ? 30 : o.speedMin;
      const speedMax = o.speedMax == null ? 240 : o.speedMax;
      const lifeMin = o.lifeMin == null ? 0.25 : o.lifeMin;
      const lifeMax = o.lifeMax == null ? 0.7 : o.lifeMax;
      const sizeMin = o.sizeMin == null ? 1 : o.sizeMin;
      const sizeMax = o.sizeMax == null ? 2.6 : o.sizeMax;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const sp = VB.rand(speedMin, speedMax);
        const life = VB.rand(lifeMin, lifeMax);
        this.add({
          kind: o.smoke ? "smoke" : "spark",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life,
          maxLife: life,
          size: VB.rand(sizeMin, sizeMax),
          color,
          drag: o.drag == null ? 3.4 : o.drag,
          streak: o.streak !== false,
        });
      }
    }

    ring(x, y, color, radius, life) {
      this.add({
        kind: "ring",
        x,
        y,
        vx: 0,
        vy: 0,
        life: life || 0.45,
        maxLife: life || 0.45,
        size: 1,
        radius: radius || 30,
        color,
        drag: 0,
      });
    }

    muzzle(x, y, angle, color) {
      for (let i = 0; i < 5; i++) {
        const a = angle + VB.rand(-0.5, 0.5);
        const sp = VB.rand(90, 300);
        const life = VB.rand(0.08, 0.22);
        this.add({
          kind: "spark",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life,
          maxLife: life,
          size: VB.rand(1.2, 2.6),
          color,
          drag: 7,
          streak: true,
        });
      }
      this.ring(x, y, color, 14, 0.18);
    }

    trail(x, y, color, size) {
      const life = VB.rand(0.12, 0.28);
      this.add({
        kind: "spark",
        x,
        y,
        vx: VB.rand(-12, 12),
        vy: VB.rand(-12, 12),
        life,
        maxLife: life,
        size: size || 1.6,
        color,
        drag: 2,
        streak: false,
      });
    }

    update(dt) {
      for (const p of this.list) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.drag) {
          const d = Math.exp(-p.drag * dt);
          p.vx *= d;
          p.vy *= d;
        }
        if (p.kind === "smoke") p.size += dt * 10;
      }
      this.list = this.list.filter((p) => p.life > 0);
    }

    draw(g) {
      for (const p of this.list) {
        const a = Math.max(0, p.life / p.maxLife);
        if (p.kind === "ring") {
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = a * 0.8;
          g.strokeStyle = p.color;
          g.lineWidth = 1 + a * 2.5;
          g.beginPath();
          g.arc(p.x, p.y, p.radius * (1 - a) + 6, 0, TAU);
          g.stroke();
          g.restore();
        } else if (p.kind === "smoke") {
          g.save();
          g.globalAlpha = a * 0.16;
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, TAU);
          g.fill();
          g.restore();
        } else {
          g.save();
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = a;
          g.fillStyle = p.color;
          if (p.streak && (Math.abs(p.vx) > 5 || Math.abs(p.vy) > 5)) {
            g.strokeStyle = p.color;
            g.lineWidth = p.size;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(p.x - p.vx * 0.028, p.y - p.vy * 0.028);
            g.stroke();
          } else {
            g.beginPath();
            g.arc(p.x, p.y, p.size, 0, TAU);
            g.fill();
          }
          g.restore();
        }
      }
    }
  }

  /* ============================ BULLET ============================ */

  class Bullet {
    constructor(o) {
      this.x = o.x;
      this.y = o.y;
      this.vx = o.vx;
      this.vy = o.vy;
      this.damage = o.damage;
      this.r = o.r || 4;
      this.color = o.color || "#4ef4ff";
      this.life = o.life || 2.4;
      this.friendly = !!o.friendly;
      this.pierce = o.pierce || 0;
      this.blast = o.blast || 0;
      this.slow = o.slow || 0;
      this.slowTime = o.slowTime || 0;
      this.mark = o.mark || 0;
      this.punched = null;
      this.dead = false;
      this.trailTimer = 0;
    }

    /* A penetrating round remembers which bodies it already punched through. */
    strike(e, game) {
      e.active = true;
      if (this.slow > 0) e.applySlow(this.slow, this.slowTime);
      if (this.mark > 0) e.markT = Math.max(e.markT, this.mark);
      e.takeDamage(this.damage, game);
      if (this.blast) {
        const radius = this.blast;
        this.blast = 0;
        game.explosion(this.x, this.y, radius, this.damage, this.color, false);
      }
    }

    detonate(game) {
      if (!this.blast) return;
      const radius = this.blast;
      const dmg = this.damage;
      this.blast = 0;
      game.explosion(this.x, this.y, radius, dmg, this.color, false);
    }

    update(dt, game) {
      if (this.dead) return;
      this.life -= dt;
      if (this.life <= 0) {
        this.dead = true;
        return;
      }

      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.03;
        game.particles.trail(this.x, this.y, this.color, this.r * 0.55);
      }

      const speed = Math.hypot(this.vx, this.vy);
      const steps = Math.max(1, Math.ceil((speed * dt) / 12));
      const sdt = dt / steps;

      for (let s = 0; s < steps; s++) {
        this.x += this.vx * sdt;
        this.y += this.vy * sdt;

        if (game.world.bulletBlocked(this.x, this.y)) {
          game.particles.burst(this.x, this.y, this.color, 5, {
            speedMax: 160,
            lifeMax: 0.3,
            sizeMax: 1.8,
          });
          if (!this.friendly) game.audio.hit();
          this.dead = true;
          this.detonate(game);
          return;
        }

        if (this.friendly) {
          for (const bar of game.barrels) {
            if (!bar.dead && VB.dist2(this.x, this.y, bar.x, bar.y) < (bar.r + this.r) ** 2) {
              bar.takeDamage(this.damage, game);
              this.dead = true;
              this.detonate(game);
              return;
            }
          }
          for (const e of game.enemies) {
            if (e.dead || e.spawnT > 0) continue;
            if (this.punched && this.punched.indexOf(e) >= 0) continue;
            if (VB.dist2(this.x, this.y, e.x, e.y) < (e.r + this.r) ** 2) {
              this.strike(e, game);
              if (this.pierce > 0) {
                this.pierce -= 1;
                (this.punched || (this.punched = [])).push(e);
                continue;
              }
              this.dead = true;
              return;
            }
          }
          if (
            game.boss &&
            !game.boss.dead &&
            game.boss.active &&
            game.boss.spawnT <= 0 &&
            (!this.punched || this.punched.indexOf(game.boss) < 0) &&
            VB.dist2(this.x, this.y, game.boss.x, game.boss.y) <
              (game.boss.r + this.r) ** 2
          ) {
            if (this.slow > 0) game.boss.applySlow(this.slow, this.slowTime);
            if (this.mark > 0) game.boss.markT = Math.max(game.boss.markT, this.mark);
            game.boss.takeDamage(this.damage, game);
            if (this.pierce > 0) {
              this.pierce -= 1;
              (this.punched || (this.punched = [])).push(game.boss);
              continue;
            }
            this.dead = true;
            this.detonate(game);
            return;
          }
        } else {
          const p = game.player;
          if (
            p &&
            !p.dead &&
            VB.dist2(this.x, this.y, p.x, p.y) < (p.r + this.r) ** 2
          ) {
            const hit = p.takeDamage(this.damage, game);
            if (hit) {
              game.particles.burst(this.x, this.y, this.color, 9, {
                speedMax: 200,
                sizeMax: 2.4,
              });
            }
            this.dead = true;
            return;
          }
        }
      }
    }

    draw(g) {
      const a = Math.atan2(this.vy, this.vx);
      g.save();
      g.translate(this.x, this.y);
      g.rotate(a);
      g.globalCompositeOperation = "lighter";
      g.shadowColor = this.color;
      g.shadowBlur = 14;
      g.fillStyle = this.color;
      g.beginPath();
      g.ellipse(0, 0, 11, this.r * 0.72, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(2, 0, this.r * 0.5, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  /* Lingering ground effect — mortar marks, tesla nets and support strikes
     are all the same object with different numbers. */
  class Field {
    constructor(o) {
      this.x = o.x;
      this.y = o.y;
      this.r = o.r || 120;
      this.life = o.dur || 3;
      this.maxLife = this.life;
      this.tick = o.tick || 0.4;
      this.tickT = 0.05;
      this.dmg = o.dmg || 10;
      this.slow = o.slow || 0;
      this.slowTime = o.slowTime || 1.2;
      this.mark = o.mark || 0;
      this.color = o.color || "#ff9d3c";
      this.hostile = !!o.hostile;
      this.t = 0;
    }

    update(dt, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) {
        game.particles.ring(this.x, this.y, this.color, this.r * 0.8, 0.4);
        return;
      }
      this.tickT -= dt;
      if (this.tickT > 0) return;
      this.tickT = this.tick;

      if (this.hostile) {
        const p = game.player;
        if (p && !p.dead && VB.dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
          p.takeDamage(this.dmg, game);
        }
      } else {
        for (const e of game.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (VB.dist2(this.x, this.y, e.x, e.y) > (this.r + e.r) ** 2) continue;
          e.active = true;
          if (this.slow > 0) e.applySlow(this.slow, this.slowTime);
          if (this.mark > 0) e.markT = Math.max(e.markT, this.mark);
          e.takeDamage(this.dmg, game);
        }
        const b = game.boss;
        if (
          b &&
          b.active &&
          !b.dead &&
          b.spawnT <= 0 &&
          VB.dist2(this.x, this.y, b.x, b.y) < (this.r + b.r) ** 2
        ) {
          if (this.slow > 0) b.applySlow(this.slow, this.slowTime);
          if (this.mark > 0) b.markT = Math.max(b.markT, this.mark);
          b.takeDamage(this.dmg, game);
        }
      }
      game.particles.ring(this.x, this.y, this.color, this.r * 0.5, 0.26);
    }

    draw(g) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 9);
      const fade = Math.min(1, this.life / 0.45);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = (0.1 + 0.07 * pulse) * fade;
      g.fillStyle = this.color;
      g.beginPath();
      g.arc(this.x, this.y, this.r, 0, TAU);
      g.fill();

      g.globalAlpha = (0.5 + 0.3 * pulse) * fade;
      g.strokeStyle = this.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.x, this.y, this.r, 0, TAU);
      g.stroke();

      g.globalAlpha = 0.3 * fade;
      g.lineWidth = 1;
      const inner = this.r * (0.35 + 0.3 * ((this.t % 1.4) / 1.4));
      g.beginPath();
      g.arc(this.x, this.y, inner, 0, TAU);
      g.stroke();

      g.globalAlpha = 0.5 * fade;
      for (let a = 0; a < 4; a++) {
        const rad = (a * TAU) / 4 + this.t * 0.6;
        g.beginPath();
        g.moveTo(this.x + Math.cos(rad) * (this.r - 12), this.y + Math.sin(rad) * (this.r - 12));
        g.lineTo(this.x + Math.cos(rad) * this.r, this.y + Math.sin(rad) * this.r);
        g.stroke();
      }
      g.restore();
    }
  }
  VB.Field = Field;

  /* ============================ PLAYER ============================ */

  // Every playable rig. One Player class reads its numbers from here, so a new
  // character is a table row rather than new code.
  // Guns are their own table so an operator is a bundle of references, and a
  // new weapon can be dropped in without touching the Player class.
  //   pierce  extra bodies a shot passes through
  //   blast   explosion radius on impact
  //   slow    0..1 speed cut applied on hit, plus slowTime seconds
  //   burst   rounds fired per trigger pull, burstGap apart (rate = volley gap)
  const WEAPONS = {
    plasmaDriver: {
      name: "PLASMA DRIVER",
      mk2: "ION LANCE",
      sound: "rifle",
      color: "#5ef6ff",
      rate: 0.15,
      dmg: 12,
      spread: 0.022,
      pellets: 1,
      speed: 1080,
      life: 1.25,
      r: 4,
    },
    rippleSmg: {
      name: "RIPPLE SMG",
      mk2: "RIPPLE OC",
      sound: "smg",
      color: "#ffe08a",
      rate: 0.078,
      dmg: 8,
      spread: 0.052,
      pellets: 1,
      speed: 1260,
      life: 1.0,
      r: 3.4,
    },
    maulCannon: {
      name: "MAUL CANNON",
      mk2: "MAUL SIEGE",
      sound: "cannon",
      color: "#ffab5f",
      rate: 0.34,
      dmg: 27,
      spread: 0.014,
      pellets: 1,
      speed: 980,
      life: 1.35,
      r: 6,
    },
    scatterfang: {
      name: "SCATTERFANG",
      mk2: "SCATTERFANG // SIEGE LOAD",
      sound: "shotgun",
      color: "#cfb0ff",
      rate: 0.52,
      dmg: 8,
      spread: 0.19,
      pellets: 5,
      speed: 880,
      life: 0.5,
      r: 3.6,
    },
    voidLance: {
      name: "VOID LANCE",
      mk2: "VOID LANCE PRIME",
      sound: "rail",
      color: "#5dffb0",
      rate: 0.82,
      dmg: 62,
      spread: 0.004,
      pellets: 1,
      speed: 2050,
      life: 0.85,
      r: 3.2,
      pierce: 3,
    },
    thumperGl: {
      name: "THUMPER GL",
      mk2: "THUMPER HE",
      sound: "launcher",
      color: "#ff9a6a",
      rate: 0.78,
      dmg: 20,
      spread: 0.03,
      pellets: 1,
      speed: 760,
      life: 1.15,
      r: 6,
      blast: 78,
    },
    arcWeave: {
      name: "ARC WEAVE",
      mk2: "ARC WEAVE MAX",
      sound: "arc",
      color: "#7ecbff",
      rate: 0.46,
      dmg: 9,
      spread: 0.05,
      pellets: 1,
      speed: 1180,
      life: 0.85,
      r: 3.4,
      burst: 2,
      burstGap: 0.075,
      slow: 0.45,
      slowTime: 1.8,
      pierce: 1,
    },
    burstCarbine: {
      name: "BURST CARBINE",
      mk2: "BURST CARBINE // SIGHTED",
      sound: "carbine",
      color: "#ff64dc",
      rate: 0.44,
      dmg: 13,
      spread: 0.012,
      pellets: 1,
      speed: 1420,
      life: 1.1,
      r: 3.6,
      burst: 3,
      burstGap: 0.062,
    },
  };
  VB.WEAPONS = WEAPONS;

  const CHARACTERS = {
    rook: {
      id: "rook",
      name: "ROOK",
      role: "SALVAGE UNIT",
      emblem: "circle",
      accent: "#4ef4ff",
      body: "#103646",
      trim: "#2f8194",
      blurb: "Balanced salvage rig. Nothing flashy, nothing weak.",
      intro: "Big talk from a voice in the walls. I'm here for the salvage.",
      hp: 100,
      shield: 50,
      speed: 255,
      r: 14,
      shieldRegen: 15,
      shieldDelay: 3.6,
      dashCd: 1.05,
      dashTime: 0.16,
      dashSpeed: 880,
      dashInvuln: 0.3,
      hitInvuln: 0.62,
      gun: WEAPONS.plasmaDriver,
      skill: {
        name: "REPAIR CLAMP",
        key: "Q",
        type: "bulwark",
        cd: 12,
        shield: 46,
        immune: 1.1,
      },
      ult: {
        name: "AEGIS PULSE",
        key: "R",
        type: "bulwark",
        heal: 34,
        shield: 999,
        immune: 2.4,
        nova: { r: 165, dmg: 26, knock: 180 },
      },
      fusion: "AEGIS BREAKER",
    },
    vyper: {
      id: "vyper",
      name: "VYPER",
      role: "STRIKE RUNNER",
      emblem: "triangle",
      accent: "#ffd166",
      body: "#3a2f10",
      trim: "#a98a2c",
      blurb: "Trades armour for rate of fire and a dash that never sleeps.",
      intro: "Ninety seconds to a dying star? I move faster than that.",
      hp: 78,
      shield: 34,
      speed: 292,
      r: 13,
      shieldRegen: 21,
      shieldDelay: 2.8,
      dashCd: 0.68,
      dashTime: 0.17,
      dashSpeed: 940,
      dashInvuln: 0.26,
      hitInvuln: 0.5,
      gun: WEAPONS.rippleSmg,
      skill: {
        name: "OVERDRIVE",
        key: "Q",
        type: "surge",
        cd: 11,
        dur: 3.4,
        rate: 0.55,
        move: 1.24,
      },
      ult: {
        name: "REDLINE",
        key: "R",
        type: "surge",
        dur: 6.5,
        rate: 0.36,
        move: 1.42,
        dashCut: 0.5,
        heal: 12,
      },
      fusion: "REDFIELD RUSH",
    },
    bastion: {
      id: "bastion",
      name: "BASTION",
      role: "SIEGE FRAME",
      emblem: "square",
      accent: "#ff8a3d",
      body: "#3b1d0e",
      trim: "#b05a24",
      blurb: "Walking bulwark. Slow, unkillable, one-shot cannon.",
      intro: "Send it. This frame was built for what lives in these halls.",
      hp: 148,
      shield: 84,
      speed: 205,
      r: 16,
      shieldRegen: 10,
      shieldDelay: 4.6,
      dashCd: 1.55,
      dashTime: 0.18,
      dashSpeed: 760,
      dashInvuln: 0.42,
      hitInvuln: 0.78,
      gun: WEAPONS.maulCannon,
      skill: {
        name: "SEISMIC SLAM",
        key: "Q",
        type: "nova",
        cd: 13,
        r: 172,
        dmg: 44,
        knock: 270,
      },
      ult: {
        name: "TECTONIC COLLAPSE",
        key: "R",
        type: "nova",
        r: 300,
        dmg: 112,
        knock: 430,
        echoes: 2,
        echoGap: 0.34,
      },
      fusion: "FAULT LINE",
    },
    sable: {
      id: "sable",
      name: "SABLE",
      role: "CLOSE QUARTERS",
      emblem: "diamond",
      accent: "#b98cff",
      body: "#251a3d",
      trim: "#7a5cc0",
      blurb: "Scatterfang at arm's length. Useless across a long hall.",
      intro: "I work close, Aurora. Tell the hallway to hold still.",
      hp: 92,
      shield: 44,
      speed: 242,
      r: 14,
      shieldRegen: 16,
      shieldDelay: 3.2,
      dashCd: 0.92,
      dashTime: 0.16,
      dashSpeed: 900,
      dashInvuln: 0.34,
      hitInvuln: 0.58,
      gun: WEAPONS.scatterfang,
      skill: {
        name: "BREACH STEP",
        key: "Q",
        type: "phase",
        cd: 9,
        reach: 270,
        nova: { r: 112, dmg: 27, knock: 150 },
      },
      ult: {
        name: "PHASE FURY",
        key: "R",
        type: "phase",
        reach: 430,
        nova: { r: 195, dmg: 78, knock: 260 },
        surge: { dur: 2.6, rate: 0.6, move: 1.2 },
      },
      fusion: "GHOST BREACH",
    },
    nyx: {
      id: "nyx",
      name: "NYX",
      role: "LONG RANGE",
      emblem: "hex",
      accent: "#5dffb0",
      body: "#0f3a2c",
      trim: "#2f9c74",
      blurb: "Railgun across a whole hall. Punishing if you stand still.",
      intro: "Give me a line of sight and a reason. I'll take the reason.",
      hp: 84,
      shield: 38,
      speed: 238,
      r: 14,
      shieldRegen: 17,
      shieldDelay: 3.4,
      dashCd: 1.15,
      dashTime: 0.15,
      dashSpeed: 850,
      dashInvuln: 0.3,
      hitInvuln: 0.6,
      gun: WEAPONS.voidLance,
      skill: {
        name: "MARK LINE",
        key: "Q",
        type: "beam",
        cd: 10,
        len: 780,
        dmg: 38,
        width: 12,
      },
      ult: {
        name: "ORBITAL SLIT",
        key: "R",
        type: "beam",
        len: 1600,
        dmg: 150,
        width: 26,
        mark: 4,
        flash: 0.5,
      },
      fusion: "DEAD RECKONING",
    },
    orbit: {
      id: "orbit",
      name: "ORBIT",
      role: "DEMOLITION",
      emblem: "chevron",
      accent: "#ff5e7a",
      body: "#3a1220",
      trim: "#a83a55",
      blurb: "Lobs grenades over cover. Mind your own feet.",
      intro: "Doors, walls, plans. I'm good at breaking all three.",
      hp: 112,
      shield: 52,
      speed: 228,
      r: 15,
      shieldRegen: 13,
      shieldDelay: 3.8,
      dashCd: 1.3,
      dashTime: 0.16,
      dashSpeed: 820,
      dashInvuln: 0.32,
      hitInvuln: 0.66,
      gun: WEAPONS.thumperGl,
      skill: {
        name: "MORTAR MARK",
        key: "Q",
        type: "zone",
        cd: 12,
        r: 124,
        dur: 3.2,
        tick: 0.4,
        dmg: 17,
        reach: 460,
      },
      ult: {
        name: "STRIKE CASCADE",
        key: "R",
        type: "zone",
        r: 158,
        dur: 2.8,
        tick: 0.34,
        dmg: 25,
        reach: 620,
        count: 3,
        gapTime: 0.5,
        flash: 0.35,
      },
      fusion: "GLASS HALLWAY",
    },
    volt: {
      id: "volt",
      name: "VOLT",
      role: "CONTAINMENT",
      emblem: "ring",
      accent: "#7ecbff",
      body: "#10304a",
      trim: "#3f86bd",
      blurb: "Slows everything it touches. Wins fights by refusing to lose them.",
      intro: "Nothing in here gets to move unless I say so.",
      hp: 96,
      shield: 62,
      speed: 236,
      r: 14,
      shieldRegen: 19,
      shieldDelay: 3.0,
      dashCd: 1.1,
      dashTime: 0.16,
      dashSpeed: 860,
      dashInvuln: 0.34,
      hitInvuln: 0.62,
      gun: WEAPONS.arcWeave,
      skill: {
        name: "TESLA NET",
        key: "Q",
        type: "zone",
        cd: 11,
        r: 150,
        dur: 4.2,
        tick: 0.45,
        dmg: 9,
        slow: 0.55,
        slowTime: 1.2,
        reach: 380,
      },
      ult: {
        name: "CAGE OVERLOAD",
        key: "R",
        type: "zone",
        r: 250,
        dur: 6,
        tick: 0.3,
        dmg: 15,
        slow: 0.72,
        slowTime: 1.6,
        reach: 300,
        nova: { r: 190, dmg: 30, knock: 120, slow: 0.7, slowTime: 3 },
      },
      fusion: "ZERO KELVIN",
    },
    harlow: {
      id: "harlow",
      name: "HARLOW",
      role: "OVERWATCH",
      emblem: "cross",
      accent: "#ff45d8",
      body: "#34122f",
      trim: "#9c3f8c",
      blurb: "Three-round bursts, painted targets, and a last stand worth seeing.",
      intro: "Cover me is a suggestion. I'd rather you just keep them busy.",
      hp: 88,
      shield: 40,
      speed: 248,
      r: 13,
      shieldRegen: 16,
      shieldDelay: 3.2,
      dashCd: 1.0,
      dashTime: 0.15,
      dashSpeed: 900,
      dashInvuln: 0.3,
      hitInvuln: 0.56,
      gun: WEAPONS.burstCarbine,
      skill: {
        name: "SPOT LINE",
        key: "Q",
        type: "beam",
        cd: 9,
        len: 640,
        dmg: 22,
        width: 10,
        mark: 4.5,
      },
      ult: {
        name: "LAST STAND",
        key: "R",
        type: "nova",
        r: 210,
        dmg: 58,
        knock: 300,
        shield: 999,
        surge: { dur: 5, rate: 0.55, move: 1.18 },
        flash: 0.3,
      },
      fusion: "PAINTED FOR THE CORE",
    },
  };

  VB.CHARACTERS = CHARACTERS;
  VB.CHAR_ORDER = [
    "rook",
    "vyper",
    "bastion",
    "sable",
    "nyx",
    "orbit",
    "volt",
    "harlow",
  ];

  class Player {
    constructor(x, y, charId) {
      const def = CHARACTERS[charId] || CHARACTERS.rook;
      this.charId = def.id;
      this.name = def.name;
      this.role = def.role;
      this.emblem = def.emblem;
      this.accent = def.accent;
      this.bodyColor = def.body;
      this.trimColor = def.trim;
      this.gun = def.gun;
      this.skill = def.skill;
      this.ultDef = def.ult;
      this.fusion = def.fusion || "LINK";

      this.skillCd = 0;
      this.skillCdMax = def.skill.cd;
      this.ultCharge = 0;
      this.ultMax = 100;
      this.surgeT = 0;
      this.surgeRate = 1;
      this.surgeMove = 1;
      this.dashCut = 1;
      this.burstLeft = 0;
      this.burstTimer = 0;

      this.x = x;
      this.y = y;
      this.r = def.r;
      this.speed = def.speed;
      this.hp = def.hp;
      this.maxHp = def.hp;
      this.shield = def.shield;
      this.maxShield = def.shield;
      this.shieldRegen = def.shieldRegen;
      this.shieldDelayMax = def.shieldDelay;
      this.dashCdMax = def.dashCd;
      this.dashTimeMax = def.dashTime;
      this.dashSpeed = def.dashSpeed;
      this.dashInvuln = def.dashInvuln;
      this.hitInvuln = def.hitInvuln;
      this.shieldDelay = 0;
      this.angle = 0;
      this.fireCooldown = 0;
      this.dashTime = 0;
      this.dashCooldown = 0;
      this.dashDirX = 1;
      this.dashDirY = 0;
      this.invuln = 0;
      this.hitFlash = 0;
      this.weaponLevel = 1;
      this.keycards = { cyan: false, gold: false };
      this.dead = false;
      this.moving = false;
      this.walkPhase = 0;
      this.ghosts = [];
      this.stepTimer = 0;
    }

    update(dt, game) {
      if (this.dead) return;
      const input = game.input;

      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.shieldDelay = Math.max(0, this.shieldDelay - dt);

      if (this.surgeT > 0) {
        this.surgeT -= dt;
        if (this.surgeT <= 0) {
          this.surgeT = 0;
          this.surgeRate = 1;
          this.surgeMove = 1;
          this.dashCut = 1;
        }
      }

      if (this.shieldDelay <= 0 && this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + this.shieldRegen * dt);
      }

      let mx = 0;
      let my = 0;
      if (input.down("KeyW") || input.down("ArrowUp")) my -= 1;
      if (input.down("KeyS") || input.down("ArrowDown")) my += 1;
      if (input.down("KeyA") || input.down("ArrowLeft")) mx -= 1;
      if (input.down("KeyD") || input.down("ArrowRight")) mx += 1;
      if (input.touch.enabled) {
        mx += input.touch.x;
        my += input.touch.y;
      }

      const m = game.mouseWorld();
      this.angle = Math.atan2(m.y - this.y, m.x - this.x);

      const mag = Math.hypot(mx, my);
      if (mag > 0) {
        mx /= mag;
        my /= mag;
      }
      const speedScale = Math.min(1, mag);
      this.moving = mag > 0;
      if (this.moving) this.walkPhase += dt * 11;

      const wantsDash = input.hit("ShiftLeft") || input.hit("ShiftRight");
      if (wantsDash && this.dashCooldown <= 0) {
        let dx = mx;
        let dy = my;
        if (!this.moving) {
          dx = Math.cos(this.angle);
          dy = Math.sin(this.angle);
        }
        this.dashTime = this.dashTimeMax;
        this.dashCooldown = this.dashCdMax * this.dashCut;
        this.invuln = Math.max(this.invuln, this.dashInvuln);
        this.dashDirX = dx;
        this.dashDirY = dy;
        this.ghosts.push({ x: this.x, y: this.y, a: this.angle, life: 0.4 });
        game.audio.dash();
        game.particles.burst(this.x, this.y, this.accent, 14, {
          speedMax: 180,
          speedMin: 40,
          lifeMax: 0.4,
          sizeMax: 2,
        });
        game.shake(3);
      }

      if (this.dashTime > 0) {
        this.dashTime -= dt;
        const sp = this.dashSpeed;
        game.world.moveCircle(this, this.dashDirX * sp * dt, this.dashDirY * sp * dt);
        this.ghosts.push({ x: this.x, y: this.y, a: this.angle, life: 0.35 });
        game.particles.trail(this.x, this.y, this.accent, 2.4);
      } else if (this.moving) {
        const sp = this.speed * this.surgeMove;
        game.world.moveCircle(this, mx * sp * speedScale * dt, my * sp * speedScale * dt);
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.22;
          game.particles.add({
            kind: "smoke",
            x: this.x - Math.cos(this.angle) * 8,
            y: this.y - Math.sin(this.angle) * 8 + VB.rand(-5, 5),
            vx: VB.rand(-12, 12),
            vy: VB.rand(-12, 12),
            life: 0.5,
            maxLife: 0.5,
            size: 2.4,
            color: "#284a58",
            drag: 2,
          });
        }
      }

      for (const gh of this.ghosts) gh.life -= dt;
      this.ghosts = this.ghosts.filter((gh) => gh.life > 0);

      const gun = this.gun;
      const mk2 = this.weaponLevel > 1;
      const wantFire =
        (input.mouse.down || input.down("Space") || input.touch.fire) &&
        game.state === "playing";

      if (wantFire && this.fireCooldown <= 0 && this.burstLeft <= 0) {
        if (gun.burst) {
          this.burstLeft = gun.burst + (mk2 ? 1 : 0);
          this.burstTimer = 0;
          this.fireCooldown = gun.rate * (mk2 ? 0.84 : 1) * this.surgeRate;
        } else {
          this.shoot(game);
          this.fireCooldown = gun.rate * (mk2 ? 0.78 : 1) * this.surgeRate;
        }
      }

      if (this.burstLeft > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
          this.shoot(game);
          this.burstLeft -= 1;
          this.burstTimer = (gun.burstGap || 0.07) * this.surgeRate;
        }
      }
    }

    shoot(game) {
      const gun = this.gun;
      const mk2 = this.weaponLevel > 1;
      const dmg = Math.round(gun.dmg * (mk2 ? 1.45 : 1));
      const pellets = gun.pellets + (mk2 && gun.pellets > 1 ? 2 : 0);
      const spread = gun.spread * (mk2 ? 1.18 : 1);
      const color = mk2 ? "#a8ffff" : gun.color;

      let spawnOff = 36;
      const consider = (x, y) => {
        const d = VB.dist(this.x, this.y, x, y);
        if (d >= 60) return;
        const da = Math.abs(VB.normAngle(VB.angleTo(this.x, this.y, x, y) - this.angle));
        if (da < 1.1) spawnOff = Math.min(spawnOff, Math.max(6, d - 4));
      };
      for (const e of game.enemies) {
        if (!e.dead && e.spawnT <= 0) consider(e.x, e.y);
      }
      for (const bar of game.barrels) {
        if (!bar.dead) consider(bar.x, bar.y);
      }

      const bx = this.x + Math.cos(this.angle) * spawnOff;
      const by = this.y + Math.sin(this.angle) * spawnOff;
      let firstAngle = this.angle;
      for (let i = 0; i < pellets; i++) {
        const a = this.angle + (i === 0 ? 0 : VB.rand(-spread, spread));
        if (i === 0) firstAngle = a;
        game.playerBullets.push(
          new Bullet({
            x: bx,
            y: by,
            vx: Math.cos(a) * gun.speed,
            vy: Math.sin(a) * gun.speed,
            damage: dmg,
            r: mk2 ? gun.r + 1 : gun.r,
            color,
            friendly: true,
            life: gun.life,
            pierce: gun.pierce || 0,
            blast: gun.blast ? Math.round(gun.blast * (mk2 ? 1.22 : 1)) : 0,
            slow: gun.slow || 0,
            slowTime: gun.slowTime || 0,
          })
        );
      }

      const mx = this.x + Math.cos(this.angle) * 36;
      const my = this.y + Math.sin(this.angle) * 36;
      game.audio.gun(gun.sound, mk2);
      game.particles.muzzle(mx, my, firstAngle, color);
      game.shake(1.1 + pellets * 0.5 + (gun.dmg > 20 ? 1.4 : 0));
    }

    takeDamage(amount, game) {
      if (this.dead || this.invuln > 0 || this.dashTime > 0) return false;
      let dmg = amount;
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, dmg);
        this.shield -= absorbed;
        dmg -= absorbed;
      }
      this.hp -= dmg;
      this.shieldDelay = this.shieldDelayMax;
      this.invuln = this.hitInvuln;
      this.hitFlash = 0.22;
      game.damageFlash = Math.min(1, game.damageFlash + 0.65);
      game.shake(11);
      game.audio.hurt();
      game.particles.burst(this.x, this.y, "#ff6b7d", 14, {
        speedMax: 210,
        sizeMax: 2.4,
      });
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        game.onPlayerDeath("Suit integrity lost aboard Nova-9.");
      }
      return true;
    }

    heal(n, game) {
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + n);
      const gained = Math.round(this.hp - before);
      if (gained > 0) {
        game.floatText(this.x, this.y - 26, `+${gained}`, "#5dffb0");
        game.particles.ring(this.x, this.y, "#5dffb0", 36, 0.5);
      }
      return gained;
    }

    draw(g, game) {
      const blink =
        this.invuln > 0 ? (Math.sin(game.time * 55) > 0 ? 0.5 : 1) : 1;
      const flicker = 0.6 + Math.sin(game.time * 34) * 0.25;

      // ground shadow
      g.save();
      g.globalAlpha = 0.4;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(this.x, this.y + 9, 21, 11, 0, 0, TAU);
      g.fill();
      g.restore();

      // dash ghosts
      for (const gh of this.ghosts) {
        g.save();
        g.globalAlpha = gh.life * 0.9;
        g.translate(gh.x, gh.y);
        g.rotate(gh.a);
        g.strokeStyle = this.accent;
        g.fillStyle = this.accent;
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(0, 0, 20, 13, 0, 0, TAU);
        g.globalAlpha = gh.life * 0.3;
        g.fill();
        g.globalAlpha = gh.life * 0.9;
        g.stroke();
        g.restore();
      }

      // shield bubble
      if (this.shield > 0.5) {
        const frac = this.shield / this.maxShield;
        g.save();
        g.translate(this.x, this.y);
        g.rotate(game.time * 0.7);
        g.globalAlpha = 0.1 + frac * 0.22;
        g.strokeStyle = this.accent;
        g.lineWidth = 1.5;
        g.setLineDash([16, 22]);
        g.beginPath();
        g.arc(0, 0, 27, 0, TAU);
        g.stroke();
        g.setLineDash([]);
        g.restore();
      }

      g.save();
      g.globalAlpha = blink;
      g.translate(this.x, this.y);

      if (this.hitFlash > 0) {
        g.save();
        g.globalAlpha = this.hitFlash * 3;
        g.fillStyle = "#ff8899";
        g.beginPath();
        g.arc(0, 0, 30, 0, TAU);
        g.fill();
        g.restore();
      }

      g.rotate(this.angle);

      // legs
      const swing = this.moving ? Math.sin(this.walkPhase) * 4 : 0;
      g.fillStyle = this.bodyColor;
      g.strokeStyle = this.trimColor;
      g.lineWidth = 1.5;
      for (const sy of [-1, 1]) {
        g.save();
        g.translate(-8, sy * 7 + swing * sy);
        g.rotate(sy * 0.13);
        VB.roundRect(g, -10, -4, 19, 8, 3);
        g.fill();
        g.stroke();
        g.restore();
      }

      // backpack
      g.fillStyle = this.bodyColor;
      VB.roundRect(g, -21, -8, 13, 16, 4);
      g.fill();
      g.strokeStyle = this.trimColor;
      g.stroke();

      // emblem
      g.save();
      g.translate(-14.5, 0);
      g.globalAlpha = blink * 0.9;
      g.strokeStyle = this.accent;
      g.lineWidth = 1.5;
      g.beginPath();
      if (this.emblem === "triangle") {
        g.moveTo(0, -4);
        g.lineTo(4, 3);
        g.lineTo(-4, 3);
        g.closePath();
      } else if (this.emblem === "square") {
        g.rect(-3.5, -3.5, 7, 7);
      } else if (this.emblem === "diamond") {
        g.moveTo(0, -4.5);
        g.lineTo(4, 0);
        g.lineTo(0, 4.5);
        g.lineTo(-4, 0);
        g.closePath();
      } else if (this.emblem === "hex") {
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6 - Math.PI / 2;
          const px = Math.cos(a) * 4.2;
          const py = Math.sin(a) * 4.2;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
      } else if (this.emblem === "chevron") {
        g.moveTo(-3.6, -4);
        g.lineTo(2.4, 0);
        g.lineTo(-3.6, 4);
        g.moveTo(0.6, -4);
        g.lineTo(6.6, 0);
        g.lineTo(0.6, 4);
      } else if (this.emblem === "ring") {
        g.arc(0, 0, 4.2, 0, TAU);
        g.moveTo(2, 0);
        g.arc(0, 0, 2, 0, TAU);
      } else if (this.emblem === "cross") {
        g.moveTo(0, -5);
        g.lineTo(0, 5);
        g.moveTo(-5, 0);
        g.lineTo(5, 0);
        g.moveTo(-2.4, -2.4);
        g.lineTo(2.4, 2.4);
      } else {
        g.arc(0, 0, 3.6, 0, TAU);
      }
      g.stroke();
      g.restore();

      // thruster
      g.save();
      g.globalCompositeOperation = "lighter";
      const thr = 7 + flicker * 6 + (this.moving ? 4 : 0);
      const tg = g.createLinearGradient(-20, 0, -20 - thr, 0);
      tg.addColorStop(0, "rgba(150,250,255,0.85)");
      tg.addColorStop(1, "rgba(40,160,255,0)");
      g.fillStyle = tg;
      g.beginPath();
      g.ellipse(-20 - thr * 0.4, 0, thr * 0.7, 4.5, 0, 0, TAU);
      g.fill();
      g.restore();

      // torso
      g.shadowColor = this.accent;
      g.shadowBlur = 12;
      g.fillStyle = this.bodyColor;
      VB.roundRect(g, -12, -11, 27, 22, 8);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = this.accent;
      g.globalAlpha = blink * 0.85;
      g.lineWidth = 1.6;
      g.stroke();
      g.globalAlpha = blink;

      // chest core
      g.fillStyle = "#b7ffff";
      g.fillRect(-4, -2, 9, 4);
      g.globalAlpha = blink * 0.4;
      g.fillStyle = this.accent;
      g.fillRect(-2, -1, 5, 2);
      g.globalAlpha = blink;

      // shoulder plates
      g.fillStyle = this.bodyColor;
      g.strokeStyle = this.trimColor;
      g.lineWidth = 1.2;
      for (const sy of [-1, 1]) {
        VB.roundRect(g, 0, sy * 10 - 5, 15, 10, 3);
        g.fill();
        g.stroke();
      }

      // helmet
      g.fillStyle = this.bodyColor;
      g.strokeStyle = this.accent;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(6, 0, 8, 0, TAU);
      g.fill();
      g.stroke();
      g.strokeStyle = this.accent;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(6, 0, 5.2, -0.85, 0.85);
      g.stroke();

      // weapon
      g.fillStyle = this.bodyColor;
      g.strokeStyle = this.trimColor;
      g.lineWidth = 1.3;
      VB.roundRect(g, 12, -3.5, 25, 7, 2.5);
      g.fill();
      g.stroke();
      const tip = this.weaponLevel > 1 ? "#ffcf5c" : this.gun.color;
      g.fillStyle = tip;
      g.shadowColor = tip;
      g.shadowBlur = 10;
      g.fillRect(34, -1.6, 4.5, 3.2);

      if (this.weaponLevel > 1) {
        g.fillStyle = "#ffcf5c";
        g.fillRect(19, -1.2, 7, 2.4);
      }

      g.restore();
    }
  }

  /* ============================ ENEMIES ============================ */

  const ENEMY_TYPES = {
    drone: { hp: 34, r: 16, speed: 155, color: "#ff5b76" },
    crawler: { hp: 26, r: 14, speed: 208, color: "#ff8a3d" },
    turret: { hp: 58, r: 18, speed: 0, color: "#ff4e6e" },
    sentinel: { hp: 95, r: 22, speed: 108, color: "#ffb03a" },
  };

  class Enemy {
    constructor(type, x, y, game) {
      const def = ENEMY_TYPES[type];
      this.type = type;
      this.x = x;
      this.y = y;
      this.r = def.r;
      this.hp = def.hp;
      this.maxHp = def.hp;
      this.speed = def.speed;
      this.color = def.color;
      this.dead = false;
      this.active = false;
      this.spawnT = 0;
      this.t = Math.random() * 10;
      this.bob = Math.random() * TAU;
      this.fireCd = VB.rand(0.8, 2.2);
      this.charge = 0;
      this.aimAngle = 0;
      this.los = false;
      this.hitFlash = 0;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.burst = 0;
      this.burstTimer = 0;
      this.contactCd = 0;
      this.slowT = 0;
      this.slowF = 1;
      this.markT = 0;
      this.faceAngle = 0;
      this.ghosts = [];
    }

    applySlow(f, time) {
      if (!time) time = 1.4;
      if (time >= this.slowT || f <= this.slowF) {
        this.slowT = Math.max(this.slowT, time);
        this.slowF = Math.min(this.slowF, 1 - f);
      }
    }

    takeDamage(n, game) {
      if (this.dead || this.spawnT > 0) return;
      if (this.markT > 0) n = Math.round(n * 1.3);
      this.hp -= n;
      game.ultCredit(Math.min(5, n * 0.05));
      this.hitFlash = 0.09;
      this.active = true;
      game.particles.burst(this.x, this.y, this.color, 4, {
        speedMax: 130,
        lifeMax: 0.35,
        sizeMax: 2,
      });
      game.audio.enemyHit();
      if (this.hp <= 0) this.die(game);
    }

    die(game) {
      if (this.dead) return;
      this.dead = true;
      const big = this.type === "sentinel" || this.type === "turret";
      game.onKill("enemy", this.x, this.y);
      game.particles.ring(this.x, this.y, this.color, big ? 60 : 38, 0.5);
      game.particles.burst(this.x, this.y, this.color, big ? 26 : 16, {
        speedMax: big ? 320 : 240,
        sizeMax: 3.2,
        lifeMax: 0.8,
      });
      game.particles.burst(this.x, this.y, "#ffd9a0", 9, {
        speedMax: 160,
        sizeMax: 2.2,
        lifeMax: 0.45,
      });
      game.audio.explode(big);
      game.shake(big ? 10 : 6);
      game.floatText(this.x, this.y - 20, "+" + (big ? 150 : 75), "#ffd166");
      if (Math.random() < 0.17) game.dropHealth(this.x, this.y);
    }

    update(dt, game) {
      if (this.dead) return;
      this.t += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.contactCd = Math.max(0, this.contactCd - dt);
      if (this.slowT > 0) {
        this.slowT -= dt;
        if (this.slowT <= 0) {
          this.slowT = 0;
          this.slowF = 1;
        }
      }
      if (this.markT > 0) this.markT -= dt;
      const p = game.player;
      if (!p || p.dead) return;
      const d = VB.dist(this.x, this.y, p.x, p.y);

      if (!this.active) {
        if (game.introLock) {
          this.aimAngle = VB.angleTo(this.x, this.y, p.x, p.y);
          return;
        }
        if (d < 780) {
          this.active = true;
          this.spawnT = 0.5;
          game.particles.ring(this.x, this.y, this.color, 44, 0.5);
          game.particles.burst(this.x, this.y, this.color, 8, {
            speedMax: 90,
            lifeMax: 0.4,
          });
        } else {
          this.aimAngle = VB.angleTo(this.x, this.y, p.x, p.y);
          return;
        }
      }

      if (this.spawnT > 0) {
        this.spawnT -= dt;
        return;
      }

      const ang = VB.angleTo(this.x, this.y, p.x, p.y);
      this.aimAngle = ang;
      this.los = game.world.lineOfSight(this.x, this.y, p.x, p.y);

      switch (this.type) {
        case "drone":
        case "sentinel":
          this.updateFlyer(dt, game, p, d, ang);
          break;
        case "crawler":
          this.updateCrawler(dt, game, p, d, ang);
          break;
        case "turret":
          this.updateTurret(dt, game, p, d, ang);
          break;
      }
    }

    moveToward(game, tx, ty, speed, dt) {
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 6) return;
      this.moveX = (dx / d) * speed;
      this.moveY = (dy / d) * speed;
      game.world.moveCircle(this, (dx / d) * speed * dt, (dy / d) * speed * dt);
    }

    updateFlyer(dt, game, p, d, ang) {
      const isSentinel = this.type === "sentinel";
      const orbit = isSentinel ? 320 : 255;
      const speed = (isSentinel ? this.speed * 0.55 : this.speed) * this.slowF;
      let tx;
      let ty;
      if (d > 620) {
        tx = p.x;
        ty = p.y;
      } else {
        const a = ang + Math.PI + this.strafeDir * (isSentinel ? 0.35 : 0.6);
        tx = p.x + Math.cos(a) * orbit;
        ty = p.y + Math.sin(a) * orbit;
      }
      const moving = this.charge <= 0 ? speed : speed * 0.35;
      this.moveToward(game, tx, ty, moving, dt);

      if (this.charge > 0) {
        this.charge -= dt;
        if (this.charge <= 0) {
          if (this.los) this.fire(game, ang, isSentinel);
          this.fireCd = isSentinel ? VB.rand(2.5, 3.2) : VB.rand(1.8, 2.5);
        }
      } else if (this.fireCd > 0) {
        this.fireCd -= dt;
      } else if (this.los && d < 620 && d > 40) {
        this.charge = isSentinel ? 0.58 : 0.42;
        if (Math.random() < 0.5) this.strafeDir *= -1;
        game.audio.taunt();
      }
    }

    fire(game, ang, isSentinel) {
      if (isSentinel) {
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * 0.17;
          game.enemyBullets.push(
            new Bullet({
              x: this.x + Math.cos(a) * 24,
              y: this.y + Math.sin(a) * 24,
              vx: Math.cos(a) * 315,
              vy: Math.sin(a) * 315,
              damage: 10,
              r: 5,
              color: "#ffb03a",
            })
          );
        }
        game.audio.enemyShoot();
        game.particles.muzzle(this.x, this.y, ang, "#ffb03a");
      } else {
        game.enemyBullets.push(
          new Bullet({
            x: this.x + Math.cos(ang) * 20,
            y: this.y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * 300,
            vy: Math.sin(ang) * 300,
            damage: 9,
            r: 4.5,
            color: "#ff6b8a",
          })
        );
        game.audio.enemyShoot();
        game.particles.muzzle(this.x, this.y, ang, "#ff6b8a");
      }
    }

    updateCrawler(dt, game, p, d, ang) {
      this.faceAngle = ang;
      const wobble = Math.sin(this.t * 7 + this.bob) * 0.32;
      const speed = this.speed * this.slowF;
      game.world.moveCircle(
        this,
        Math.cos(ang + wobble) * speed * dt,
        Math.sin(ang + wobble) * speed * dt
      );

      if (d < this.r + p.r + 5 && this.contactCd <= 0) {
        this.contactCd = 0.9;
        if (p.takeDamage(11, game)) {
          game.shake(5);
          const kick = 18;
          game.world.moveCircle(p, Math.cos(ang) * kick, Math.sin(ang) * kick);
        }
      }
    }

    updateTurret(dt, game, p, d, ang) {
      if (VB.dist(this.x, this.y, p.x, p.y) < 650 && game.world.lineOfSight(this.x, this.y, p.x, p.y)) {
        this.aimAngle = ang;
      }

      if (this.burst > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
          this.burstTimer = 0.14;
          this.burst -= 1;
          const a = this.aimAngle + VB.rand(-0.04, 0.04);
          game.enemyBullets.push(
            new Bullet({
              x: this.x + Math.cos(a) * 26,
              y: this.y + Math.sin(a) * 26,
              vx: Math.cos(a) * 360,
              vy: Math.sin(a) * 360,
              damage: 9,
              r: 4.5,
              color: "#ff5b76",
            })
          );
          game.audio.enemyShoot();
          game.particles.muzzle(this.x, this.y, a, "#ff5b76");
          if (this.burst === 0) this.fireCd = 2.2;
        }
      } else if (this.charge > 0) {
        this.charge -= dt;
        if (this.charge <= 0) {
          this.burst = 3;
          this.burstTimer = 0;
        }
      } else if (this.fireCd > 0) {
        this.fireCd -= dt;
      } else if (d < 660 && this.los) {
        this.charge = 0.55;
      }
    }

    /* -------- drawing -------- */

    draw(g, game) {
      if (this.dead) return;
      const alpha = this.spawnT > 0 ? 1 - this.spawnT / 0.5 : 1;
      g.save();
      g.globalAlpha = Math.max(0.15, alpha);

      if (this.spawnT > 0) {
        g.strokeStyle = this.color;
        g.lineWidth = 2;
        g.globalAlpha = this.spawnT * 1.4;
        g.beginPath();
        g.arc(this.x, this.y, 14 + (1 - this.spawnT / 0.5) * 34, 0, TAU);
        g.stroke();
        g.globalAlpha = Math.max(0.15, alpha);
      }

      if (this.type === "drone") this.drawDrone(g, game);
      else if (this.type === "sentinel") this.drawSentinel(g, game);
      else if (this.type === "crawler") this.drawCrawler(g, game);
      else if (this.type === "turret") this.drawTurret(g, game);

      if (this.hp < this.maxHp && this.spawnT <= 0) {
        const w = this.type === "sentinel" ? 40 : 30;
        const y = this.y - this.r - 14;
        g.fillStyle = "rgba(4,10,16,0.8)";
        g.fillRect(this.x - w / 2, y, w, 3);
        g.fillStyle = this.color;
        g.fillRect(this.x - w / 2, y, (w * Math.max(0, this.hp / this.maxHp)), 3);
      }
      g.restore();
    }

    drawDrone(g, game) {
      const bob = Math.sin(this.t * 3 + this.bob) * 3;
      g.save();
      g.translate(this.x, this.y + bob);

      g.globalAlpha *= 0.35;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(0, 18 - bob, 17, 6, 0, 0, TAU);
      g.fill();
      g.globalAlpha /= 0.35;

      g.save();
      g.rotate(this.t * 0.9);
      g.strokeStyle = "rgba(255,91,118,0.6)";
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        g.beginPath();
        g.arc(0, 0, 20, a, a + 1.2);
        g.stroke();
      }
      g.restore();

      g.fillStyle = "#1a0b12";
      g.strokeStyle = this.hitFlash > 0 ? "#fff" : this.color;
      g.lineWidth = 1.8;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const x = Math.cos(a) * 13;
        const y = Math.sin(a) * 13;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
      g.stroke();

      const eyeA = this.aimAngle;
      g.fillStyle = this.charge > 0 ? "#ffffff" : "#ff2e55";
      g.shadowColor = "#ff3355";
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(Math.cos(eyeA) * 5, Math.sin(eyeA) * 5, this.charge > 0 ? 4.4 : 3, 0, TAU);
      g.fill();
      g.shadowBlur = 0;

      if (this.charge > 0) {
        g.strokeStyle = "rgba(255,120,140,0.6)";
        g.beginPath();
        g.arc(0, 0, 17 + (1 - this.charge / 0.42) * 6, 0, TAU);
        g.stroke();
      }
      g.restore();
    }

    drawSentinel(g, game) {
      const bob = Math.sin(this.t * 2 + this.bob) * 2;
      g.save();
      g.translate(this.x, this.y + bob);

      g.save();
      g.rotate(-this.t * 0.7);
      g.strokeStyle = "rgba(255,176,58,0.4)";
      g.setLineDash([8, 7]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 27, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.restore();

      g.fillStyle = "#1b1408";
      g.strokeStyle = this.hitFlash > 0 ? "#fff" : this.color;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const x = Math.cos(a) * 20;
        const y = Math.sin(a) * 20;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
      g.stroke();

      // side pods
      const podA = this.aimAngle;
      for (const dir of [-1, 1]) {
        const px = Math.cos(podA + dir * 1.5) * 17;
        const py = Math.sin(podA + dir * 1.5) * 17;
        g.fillStyle = "#2a1e0c";
        g.strokeStyle = "rgba(255,176,58,0.6)";
        g.beginPath();
        g.arc(px, py, 5, 0, TAU);
        g.fill();
        g.stroke();
      }

      g.fillStyle = this.charge > 0 ? "#fff3d0" : "#ffb03a";
      g.shadowColor = "#ffb03a";
      g.shadowBlur = 14;
      g.beginPath();
      g.arc(Math.cos(podA) * 6, Math.sin(podA) * 6, 4.6, 0, TAU);
      g.fill();
      g.shadowBlur = 0;

      if (this.charge > 0) {
        g.strokeStyle = "rgba(255,176,58,0.55)";
        g.beginPath();
        g.arc(0, 0, 24 + (1 - this.charge / 0.58) * 8, 0, TAU);
        g.stroke();
      }
      g.restore();
    }

    drawCrawler(g, game) {
      const ang = this.faceAngle;
      g.save();
      g.translate(this.x, this.y);
      g.rotate(ang);

      g.globalAlpha *= 0.32;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(0, 7, 18, 8, 0, 0, TAU);
      g.fill();
      g.globalAlpha /= 0.32;

      // legs
      g.strokeStyle = this.hitFlash > 0 ? "#fff" : "rgba(255,138,61,0.85)";
      g.lineWidth = 2;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const baseX = -8 + i * 8;
          const sway = Math.sin(this.t * 14 + i * 2 + side) * 3.4;
          g.beginPath();
          g.moveTo(baseX, side * 5);
          g.lineTo(baseX + 4 + sway, side * 14);
          g.lineTo(baseX + 10 + sway, side * 16);
          g.stroke();
        }
      }

      // body
      g.fillStyle = "#24110a";
      g.strokeStyle = this.hitFlash > 0 ? "#fff" : this.color;
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(0, 0, 15, 10, 0, 0, TAU);
      g.fill();
      g.stroke();

      // spikes
      g.fillStyle = "rgba(255,138,61,0.6)";
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(i * 6 - 3, -8);
        g.lineTo(i * 6, -14);
        g.lineTo(i * 6 + 3, -8);
        g.fill();
      }

      // head
      g.fillStyle = "#1b0d08";
      g.strokeStyle = this.color;
      g.beginPath();
      g.arc(11, 0, 6, 0, TAU);
      g.fill();
      g.stroke();

      g.fillStyle = "#ff4e2e";
      g.shadowColor = "#ff5a2e";
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(13, 0, 2.4, 0, TAU);
      g.fill();
      g.restore();
    }

    drawTurret(g, game) {
      g.save();
      g.translate(this.x, this.y);

      g.globalAlpha *= 0.4;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(0, 8, 23, 9, 0, 0, TAU);
      g.fill();
      g.globalAlpha /= 0.4;

      g.fillStyle = "#160a0f";
      g.strokeStyle = this.hitFlash > 0 ? "#fff" : "rgba(255,78,110,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 18, 0, TAU);
      g.fill();
      g.stroke();

      g.strokeStyle = "rgba(255,78,110,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(0, 0, 13, 0, TAU);
      g.stroke();

      g.save();
      g.rotate(this.aimAngle);
      g.fillStyle = "#261019";
      g.strokeStyle = "#ff4e6e";
      VB.roundRect(g, 2, -4, 26, 8, 2);
      g.fill();
      g.stroke();
      g.fillStyle = this.charge > 0 ? "#fff" : "#ff4e6e";
      g.shadowColor = "#ff4e6e";
      g.shadowBlur = this.charge > 0 ? 16 : 8;
      g.fillRect(24, -2, 6, 4);
      g.shadowBlur = 0;
      g.restore();

      g.fillStyle = this.charge > 0 ? "#ffd0d8" : "#ff4e6e";
      g.beginPath();
      g.arc(0, 0, 4, 0, TAU);
      g.fill();

      if (this.charge > 0 || this.burst > 0) {
        const p = game.player;
        if (p && this.los) {
          g.strokeStyle = "rgba(255,78,110,0.14)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(p.x - this.x, p.y - this.y);
          g.stroke();
        }
      }

      g.restore();
    }
  }

  /* ============================ BOSS ============================ */

  class Boss {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.homeX = x;
      this.homeY = y;
      this.r = 54;
      this.hp = 1600;
      this.maxHp = 1600;
      this.dead = false;
      this.active = false;
      this.spawnT = 0;
      this.t = 0;
      this.hitFlash = 0;
      this.attack = null;
      this.attackT = 0;
      this.cd = 1.8;
      this.spiralAngle = 0;
      this.spiralTick = 0;
      this.summonCd = 5;
      this.summonCount = 0;
      this.contactCd = 0;
      this.slowT = 0;
      this.slowF = 1;
      this.markT = 0;
      this.phase2 = false;
      this.phase3 = false;
      this.deathT = 0;
      this.lastAttack = "";
    }

    activate(game) {
      if (this.active || this.dead) return;
      this.active = true;
      this.spawnT = 1.4;
      this.cd = 1.4;
      game.audio.bossRoar();
      game.shake(16);
      game.particles.ring(this.x, this.y, "#ff45d8", 160, 1.2);
      game.particles.burst(this.x, this.y, "#ff45d8", 32, {
        speedMax: 300,
        sizeMax: 3,
        lifeMax: 1,
      });
    }

    applySlow(f, time) {
      if (this.dead) return;
      if (time >= this.slowT || f <= this.slowF) {
        this.slowT = Math.max(this.slowT, time);
        this.slowF = Math.min(this.slowF, 1 - f);
      }
    }

    takeDamage(n, game) {
      if (this.dead || this.spawnT > 0 || !this.active) return;
      if (this.markT > 0) n = Math.round(n * 1.3);
      this.hp -= n;
      game.ultCredit(Math.min(3, n * 0.02));
      this.hitFlash = 0.07;

      if (!this.phase2 && this.hp < this.maxHp * 0.66) {
        this.phase2 = true;
        game.say("AURORA: You're hurting me.", 3.4, "AURORA");
        game.toast("AURORA // PHASE SHIFT", "magenta");
        game.audio.alarm();
        this.spawnAdds(game, 2);
        game.particles.ring(this.x, this.y, "#ff45d8", 180, 0.9);
      }
      if (!this.phase3 && this.hp < this.maxHp * 0.33) {
        this.phase3 = true;
        game.say("AURORA: If I burn, you burn with me.", 3.8, "AURORA");
        game.toast("CORE CRITICAL — FINISH IT", "red");
        game.audio.bossRoar();
        this.spawnAdds(game, 2);
        game.particles.ring(this.x, this.y, "#ff2050", 200, 1.1);
      }

      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        this.deathT = 0;
        game.particles.ring(this.x, this.y, "#ff45d8", 260, 1.4);
        game.particles.burst(this.x, this.y, "#ff45d8", 60, {
          speedMax: 420,
          sizeMax: 4.4,
          lifeMax: 1.4,
        });
        game.particles.burst(this.x, this.y, "#ffffff", 30, {
          speedMax: 260,
          sizeMax: 2.6,
          lifeMax: 0.8,
        });
        game.audio.explode(true);
        game.audio.bossRoar();
        game.shake(24);
        game.onBossDefeated();
      }
    }

    chooseAttack(game) {
      const frac = this.hp / this.maxHp;
      if (this.summonCd <= 0 && frac < 0.72 && this.summonCount < 5) {
        this.begin("summon", 0.8);
        return;
      }
      const pool =
        frac < 0.34
          ? ["spiral", "aimed", "radial", "spiral", "aimed"]
          : frac < 0.67
          ? ["radial", "aimed", "spiral", "aimed"]
          : ["radial", "aimed", "aimed"];
      let pick = VB.choice(pool);
      if (pick === this.lastAttack && Math.random() < 0.6) {
        pick = VB.choice(pool.filter((x) => x !== pick));
      }
      this.lastAttack = pick;
      if (pick === "radial") this.begin("windup-radial", 0.7);
      else if (pick === "aimed") this.begin("windup-aim", 0.42);
      else this.begin("windup-spiral", 0.55);
    }

    begin(attack, time) {
      this.attack = attack;
      this.attackT = time;
    }

    update(dt, game) {
      if (!this.active) return;
      this.t += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.contactCd = Math.max(0, this.contactCd - dt);
      if (this.slowT > 0) {
        this.slowT -= dt;
        if (this.slowT <= 0) {
          this.slowT = 0;
          this.slowF = 1;
        }
      }
      if (this.markT > 0) this.markT -= dt;

      if (this.dead) {
        this.deathT += dt;
        if (this.deathT < 2.6 && Math.random() < 0.3) {
          game.particles.burst(
            this.x + VB.rand(-40, 40),
            this.y + VB.rand(-40, 40),
            Math.random() < 0.5 ? "#ff45d8" : "#ffb14a",
            3,
            { speedMax: 120, lifeMax: 0.7, sizeMax: 2.6 }
          );
        }
        return;
      }

      if (this.spawnT > 0) {
        this.spawnT -= dt;
        this.x = this.homeX;
        this.y = this.homeY;
        return;
      }

      this.summonCd -= dt;

      // slow drift
      this.x = this.homeX + Math.sin(this.t * 0.42) * 36;
      this.y = this.homeY + Math.cos(this.t * 0.57) * 22;

      const p = game.player;
      if (p && !p.dead) {
        if (VB.dist(this.x, this.y, p.x, p.y) < this.r + p.r + 6 && this.contactCd <= 0) {
          this.contactCd = 1.1;
          p.takeDamage(16, game);
          game.shake(8);
        }
      }

      if (this.attack) {
        this.attackT -= dt * this.slowF;
        switch (this.attack) {
          case "windup-radial":
            if (this.attackT <= 0) {
              this.fireRadial(game);
              this.begin("recover", 0.75);
            }
            break;
          case "windup-aim":
            if (this.attackT <= 0) {
              this.fireAimed(game);
              this.begin("recover", 0.6);
            }
            break;
          case "windup-spiral":
            if (this.attackT <= 0) {
              this.spiralAngle = VB.angleTo(this.x, this.y, p.x, p.y);
              this.spiralTick = 0;
              this.begin("spiral", 1.55);
            }
            break;
          case "spiral":
            this.spiralTick -= dt;
            if (this.spiralTick <= 0) {
              this.spiralTick = 0.075;
              this.spiralAngle += 0.3;
              const boost = this.phase3 ? 1.15 : 1;
              for (const dir of [0, Math.PI]) {
                const a = this.spiralAngle + dir;
                game.enemyBullets.push(
                  new Bullet({
                    x: this.x + Math.cos(a) * 52,
                    y: this.y + Math.sin(a) * 52,
                    vx: Math.cos(a) * 250 * boost,
                    vy: Math.sin(a) * 250 * boost,
                    damage: 10,
                    r: 6,
                    color: "#ff45d8",
                  })
                );
              }
            }
            if (this.attackT <= 0) this.begin("recover", 0.65);
            break;
          case "summon":
            if (this.attackT <= 0) {
              this.spawnAdds(game, 2);
              this.summonCd = 8.5;
              this.begin("recover", 0.8);
            }
            break;
          case "recover":
            if (this.attackT <= 0) {
              this.attack = null;
              this.cd = this.phase3 ? VB.rand(0.35, 0.6) : this.phase2 ? VB.rand(0.55, 0.9) : VB.rand(0.8, 1.2);
            }
            break;
        }
      } else {
        this.cd -= dt;
        if (this.cd <= 0) this.chooseAttack(game);
      }
    }

    spawnAdds(game, count) {
      const spots = [
        [45.5 * T, 12 * T],
        [55.5 * T, 12 * T],
        [50.5 * T, 17.6 * T],
        [50.5 * T, 7.6 * T],
      ];
      for (let i = 0; i < count; i++) {
        const spot = spots[(this.summonCount + i) % spots.length];
        const type = this.phase3 ? (i % 2 === 0 ? "crawler" : "drone") : "drone";
        const e = game.spawnEnemyAt(type, spot[0], spot[1]);
        if (e) {
          e.active = true;
          e.spawnT = 0.55;
        }
        game.particles.ring(spot[0], spot[1], "#ff45d8", 36, 0.5);
      }
      this.summonCount += count;
      game.audio.gate();
    }

    fireRadial(game) {
      const count = this.phase3 ? 24 : this.phase2 ? 20 : 16;
      const offset = Math.random() * TAU;
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * TAU;
        game.enemyBullets.push(
          new Bullet({
            x: this.x + Math.cos(a) * 54,
            y: this.y + Math.sin(a) * 54,
            vx: Math.cos(a) * 228,
            vy: Math.sin(a) * 228,
            damage: 10,
            r: 6,
            color: "#ff4fd0",
          })
        );
      }
      game.particles.ring(this.x, this.y, "#ff45d8", 90, 0.6);
      game.audio.enemyShoot();
      game.shake(7);
    }

    fireAimed(game) {
      const p = game.player;
      if (!p) return;
      const base = VB.angleTo(this.x, this.y, p.x, p.y);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.16;
        game.enemyBullets.push(
          new Bullet({
            x: this.x + Math.cos(a) * 52,
            y: this.y + Math.sin(a) * 52,
            vx: Math.cos(a) * 345,
            vy: Math.sin(a) * 345,
            damage: 11,
            r: 5.5,
            color: "#ff8ae8",
          })
        );
      }
      game.audio.enemyShoot();
      game.particles.muzzle(this.x, this.y, base, "#ff8ae8");
    }

    draw(g, game) {
      if (!this.active) return;
      g.save();
      g.translate(this.x, this.y);

      if (this.dead) {
        g.globalAlpha = 0.8;
        g.fillStyle = "#120812";
        g.strokeStyle = "rgba(255,69,216,0.2)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, 44, 0, TAU);
        g.fill();
        g.stroke();
        g.strokeStyle = "rgba(255,120,60,0.25)";
        g.beginPath();
        g.moveTo(-30, -20);
        g.lineTo(26, 18);
        g.moveTo(-10, 30);
        g.lineTo(18, -32);
        g.stroke();
        g.restore();
        return;
      }

      const frac = this.hp / this.maxHp;
      const rage = this.phase3;
      const color = rage ? "#ff2e5c" : "#ff45d8";
      const pulse = 0.5 + Math.sin(this.t * 3) * 0.2;
      const spawnScale = this.spawnT > 0 ? 1 - this.spawnT / 1.4 : 1;

      g.scale(Math.max(0.2, spawnScale), Math.max(0.2, spawnScale));
      g.globalAlpha = this.spawnT > 0 ? 0.55 + (1 - this.spawnT / 1.4) * 0.45 : 1;

      // aura
      g.save();
      g.globalCompositeOperation = "lighter";
      const aura = g.createRadialGradient(0, 0, 10, 0, 0, 150);
      aura.addColorStop(0, rage ? "rgba(255,46,92,0.3)" : "rgba(255,69,216,0.26)");
      aura.addColorStop(0.5, "rgba(160,40,200,0.08)");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = aura;
      g.beginPath();
      g.arc(0, 0, 150, 0, TAU);
      g.fill();
      g.restore();

      // outer rings
      g.save();
      g.rotate(this.t * 0.35);
      g.strokeStyle = `rgba(255,69,216,${0.24 + pulse * 0.18})`;
      g.lineWidth = 2;
      g.setLineDash([26, 18]);
      g.beginPath();
      g.arc(0, 0, 90, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.restore();

      g.save();
      g.rotate(-this.t * 0.55);
      g.strokeStyle = "rgba(255,69,216,0.32)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        g.beginPath();
        g.arc(0, 0, 72, a, a + 0.6);
        g.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.fillStyle = "rgba(255,140,235,0.4)";
        g.beginPath();
        g.arc(Math.cos(a) * 72, Math.sin(a) * 72, 2.4, 0, TAU);
        g.fill();
      }
      g.restore();

      // shell
      const shell = g.createRadialGradient(-18, -20, 6, 0, 0, 58);
      shell.addColorStop(0, "#3c1a45");
      shell.addColorStop(0.6, "#190a20");
      shell.addColorStop(1, "#0a0410");
      g.fillStyle = shell;
      g.strokeStyle = this.hitFlash > 0 ? "#ffffff" : color;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 54, 0, TAU);
      g.fill();
      g.stroke();

      // armor segments
      g.save();
      g.rotate(this.t * 0.18);
      g.strokeStyle = "rgba(255,140,235,0.28)";
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
        g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
        g.stroke();
      }
      g.restore();

      // eye
      const aim = VB.angleTo(this.x, this.y, game.player.x, game.player.y);
      const ex = Math.cos(aim) * 9;
      const ey = Math.sin(aim) * 9;
      const eyeGlow = this.attack && this.attack.startsWith("windup") ? 1 : pulse;
      g.save();
      g.globalCompositeOperation = "lighter";
      const eg = g.createRadialGradient(ex, ey, 1, ex, ey, 30);
      eg.addColorStop(0, "rgba(255,255,255,0.95)");
      eg.addColorStop(0.3, color);
      eg.addColorStop(1, "rgba(255,69,216,0)");
      g.fillStyle = eg;
      g.beginPath();
      g.arc(ex, ey, 26 + eyeGlow * 10, 0, TAU);
      g.fill();
      g.restore();

      g.fillStyle = "#050208";
      g.beginPath();
      g.ellipse(0, 0, 26, 21, 0, 0, TAU);
      g.fill();
      g.strokeStyle = color;
      g.globalAlpha = 0.6;
      g.lineWidth = 1.4;
      g.stroke();
      g.globalAlpha = 1;

      g.fillStyle = "#ffe9ff";
      g.beginPath();
      g.arc(ex, ey, 7, 0, TAU);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.arc(ex, ey, 4.4, 0, TAU);
      g.fill();

      // charge telegraph
      if (this.attack && this.attack.startsWith("windup")) {
        const t = this.attackT;
        const radius = 80 + Math.sin(this.t * 20) * 5 - t * 40;
        g.strokeStyle = `rgba(255,150,240,${0.3 + Math.sin(this.t * 24) * 0.2})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, Math.max(60, radius), 0, TAU);
        g.stroke();
      }

      g.restore();
    }
  }

  /* ============================ PICKUP ============================ */

  const PICKUP_DEFS = {
    health: { color: "#5dffb0", label: "MED-KIT" },
    cyan: { color: "#4ef4ff", label: "CYAN CLEARANCE" },
    gold: { color: "#ffd166", label: "REACTOR KEY" },
    upgrade: { color: "#ff9d3c", label: "MK II CORE" },
  };

  class Pickup {
    constructor(type, x, y) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.homeX = x;
      this.homeY = y;
      this.r = 16;
      this.t = Math.random() * 6;
      this.dead = false;
      this.color = PICKUP_DEFS[type].color;
      this.label = PICKUP_DEFS[type].label;
    }

    update(dt, game) {
      if (this.dead) return;
      this.t += dt;
      const p = game.player;
      if (!p || p.dead) return;
      const d = VB.dist(this.x, this.y, p.x, p.y);
      if (d < 120 && this.type !== "upgrade") {
        const a = VB.angleTo(this.x, this.y, p.x, p.y);
        const sp = 130 + (120 - d) * 2;
        game.world.moveCircle(this, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
      }
      if (d < 30) {
        if (game.collectPickup(this)) this.dead = true;
      }
    }

    draw(g, game) {
      if (this.dead) return;
      const bob = Math.sin(this.t * 2.5) * 4;
      const x = this.x;
      const y = this.y + bob;
      const color = this.color;

      g.save();
      g.globalAlpha = 0.36;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(this.x, this.y + 14, 15, 6, 0, 0, TAU);
      g.fill();
      g.restore();

      g.save();
      g.globalCompositeOperation = "lighter";
      const grad = g.createRadialGradient(x, y, 2, x, y, 44);
      grad.addColorStop(0, color + "aa");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 44, 0, TAU);
      g.fill();
      g.restore();

      g.save();
      g.translate(x, y);
      g.shadowColor = color;
      g.shadowBlur = 16;
      g.strokeStyle = color;
      g.fillStyle = "rgba(6,18,26,0.9)";
      g.lineWidth = 1.6;

      if (this.type === "health") {
        VB.roundRect(g, -12, -12, 24, 24, 5);
        g.fill();
        g.stroke();
        g.fillStyle = "#c8ffe6";
        g.fillRect(-3, -8, 6, 16);
        g.fillRect(-8, -3, 16, 6);
      } else if (this.type === "upgrade") {
        g.rotate(this.t * 0.8);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const r = i % 2 === 0 ? 16 : 11;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
        g.stroke();
        g.rotate(-this.t * 0.8);
        g.fillStyle = "#ffe2b8";
        g.beginPath();
        g.moveTo(-2, -8);
        g.lineTo(6, -2);
        g.lineTo(1, -1);
        g.lineTo(4, 8);
        g.lineTo(-6, 0);
        g.lineTo(0, -2);
        g.closePath();
        g.fill();
      } else {
        g.rotate(Math.sin(this.t * 1.4) * 0.15);
        VB.roundRect(g, -13, -9, 26, 18, 3);
        g.fill();
        g.stroke();
        g.fillStyle = color + "55";
        g.fillRect(-9, -5, 10, 7);
        g.fillStyle = "#fff";
        g.fillRect(-8, 4, 16, 2);
        g.strokeStyle = "rgba(255,255,255,0.4)";
        g.strokeRect(3, -5, 6, 6);
      }
      g.restore();

      const p = game.player;
      if (p && VB.dist(p.x, p.y, this.x, this.y) < 110) {
        g.save();
        g.fillStyle = "rgba(2,8,14,0.8)";
        g.font = '10px "Consolas",monospace';
        const text = this.label;
        const w = g.measureText(text).width + 16;
        g.fillRect(x - w / 2, y - 44, w, 18);
        g.strokeStyle = color + "66";
        g.strokeRect(x - w / 2, y - 44, w, 18);
        g.fillStyle = color;
        g.textAlign = "center";
        g.fillText(text, x, y - 31);
        g.restore();
      }
    }
  }

  /* ============================ BARREL ============================ */

  class Barrel {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.r = 13;
      this.hp = 22;
      this.dead = false;
      this.t = Math.random() * 8;
      this.hitFlash = 0;
    }

    takeDamage(n, game) {
      if (this.dead) return;
      if (this.markT > 0) n = Math.round(n * 1.3);
      this.hp -= n;
      this.hitFlash = 0.12;
      game.audio.enemyHit();
      if (this.hp <= 0) {
        this.dead = true;
        game.explosion(this.x, this.y, 128, 32, "#ffb14a");
      }
    }

    draw(g, game) {
      if (this.dead) return;
      const pulse = 0.5 + Math.sin(this.t * 5) * 0.5;
      g.save();
      g.translate(this.x, this.y);
      g.globalAlpha = 0.4;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(0, 8, 15, 6, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;

      g.fillStyle = this.hitFlash > 0 ? "#fff" : "#261408";
      g.strokeStyle = "#ffb14a";
      g.lineWidth = 1.6;
      VB.roundRect(g, -12, -15, 24, 30, 4);
      g.fill();
      g.stroke();

      g.fillStyle = "rgba(255,177,74,0.75)";
      g.fillRect(-12, -4, 24, 5);
      g.fillStyle = "rgba(10,8,4,0.9)";
      for (let i = -9; i < 12; i += 6) {
        g.beginPath();
        g.moveTo(i, 1);
        g.lineTo(i + 4, -4);
        g.lineTo(i + 4, 1);
        g.closePath();
        g.fill();
      }

      g.fillStyle = "rgba(255,177,74,0.5)";
      g.fillRect(-8, -12, 16, 2);

      g.fillStyle = pulse > 0.5 ? "#ff4d3d" : "#7a2419";
      g.shadowColor = "#ff4d3d";
      g.shadowBlur = pulse * 12;
      g.beginPath();
      g.arc(0, -18, 2.6, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  VB.Particles = Particles;
  VB.Bullet = Bullet;
  VB.Player = Player;
  VB.Enemy = Enemy;
  VB.Boss = Boss;
  VB.Pickup = Pickup;
  VB.Barrel = Barrel;
  VB.stage && VB.stage("crew");
})();
