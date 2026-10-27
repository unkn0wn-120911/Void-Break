(function () {
  "use strict";
  const VB = window.VB;
  const T = VB.TILE;

  class World {
    constructor() {
      this.tw = 64;
      this.th = 46;
      this.tile = T;
      this.pw = this.tw * T;
      this.ph = this.th * T;

      this.grid = [];
      for (let y = 0; y < this.th; y++) this.grid.push(new Uint8Array(this.tw));
      this.roommap = new Int16Array(this.tw * this.th).fill(-1);
      this.revealed = new Uint8Array(this.tw * this.th);

      this.rooms = [];
      this.doors = [];
      this.terminals = [];
      this.lights = [];
      this.spawn = { x: 9.5 * T, y: 39 * T };
      this.airlock = { x: 3.55 * T, y: 38.5 * T, r: 46 };

      this.build();
      this.staticCanvas = this.renderStatic();
    }

    roomById(id) {
      return this.rooms.find((r) => r.id === id) || null;
    }

    carveRect(x, y, w, h, roomIndex) {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (tx < 1 || ty < 1 || tx >= this.tw - 1 || ty >= this.th - 1) continue;
          this.grid[ty][tx] = 1;
          this.roommap[ty * this.tw + tx] = roomIndex == null ? -1 : roomIndex;
        }
      }
    }

    setWall(x, y, w, h) {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) continue;
          this.grid[ty][tx] = 0;
        }
      }
    }

    build() {
      const defs = [
        { id: "docking", name: "DOCKING BAY", code: "D-01", x: 3, y: 33, w: 14, h: 10, color: "#37e6ff", floor: "#071720" },
        { id: "medbay", name: "MEDICAL", code: "M-02", x: 20, y: 33, w: 11, h: 9, color: "#5dffb0", floor: "#061a15" },
        { id: "hub", name: "ATRIUM", code: "H-00", x: 27, y: 22, w: 13, h: 9, color: "#9b8cff", floor: "#0a0d1c" },
        { id: "security", name: "SECURITY", code: "S-04", x: 5, y: 7, w: 15, h: 12, color: "#ff4e6a", floor: "#160a10" },
        { id: "armory", name: "ARMORY", code: "A-05", x: 29, y: 6, w: 10, h: 9, color: "#ffd166", floor: "#141106" },
        { id: "engineering", name: "ENGINEERING", code: "E-07", x: 44, y: 26, w: 14, h: 14, color: "#ff9a3d", floor: "#160f07" },
        { id: "bridge", name: "AI CORE", code: "B-09", x: 44, y: 6, w: 14, h: 14, color: "#ff45d8", floor: "#150818" },
      ];

      this.rooms = defs.map((d, i) => {
        const room = Object.assign({}, d, {
          index: i,
          discovered: false,
          cx: (d.x + d.w / 2) * T,
          cy: (d.y + d.h / 2) * T,
        });
        return room;
      });

      this.rooms.forEach((r) => this.carveRect(r.x, r.y, r.w, r.h, r.index));

      const corridors = [
        [16, 37, 4, 2],
        [24, 29, 2, 5],
        [24, 29, 4, 2],
        [32, 14, 2, 9],
        [19, 12, 9, 2],
        [26, 12, 2, 11],
        [39, 28, 6, 2],
        [49, 19, 2, 8],
      ];
      corridors.forEach((c) => this.carveRect(c[0], c[1], c[2], c[3], -1));

      // structural cover in the AI core
      this.setWall(46, 9, 2, 2);
      this.setWall(53, 9, 2, 2);
      this.setWall(46, 15, 2, 2);
      this.setWall(53, 15, 2, 2);

      // reactor housing
      this.setWall(50, 30, 2, 3);

      this.makeDoor("armory", "cyan", "h", 33 * T, 18 * T);
      this.makeDoor("engineering", "cyan", "v", 41 * T, 29 * T);
      this.makeDoor("bridge", "gold", "h", 50 * T, 22 * T);

      this.terminals = [
        {
          id: "med",
          x: 22 * T,
          y: 34.3 * T,
          title: "MEDICAL LOG // DR. VALE",
          meta: "ARCHIVE 0442 — 19 HOURS BEFORE SILENCE",
          read: false,
          body:
            "AURORA sealed the medical wing at 0200. She says it's quarantine protocol.\n\nThere is no quarantine. The crew is scared of her, not of a pathogen. She watches through every lens and asks why we are 'leaving her'.\n\nI told her the evacuation order came from Command. She said Command stopped answering three days ago.\n\nIf anyone finds this: the security card is in Ibarra's office. Take it. Do not talk to her. She remembers every voice.",
        },
        {
          id: "security",
          x: 6.7 * T,
          y: 8.4 * T,
          title: "SECURITY DISPATCH // CHIEF IBARRA",
          meta: "PRIORITY BLACK — LAST TRANSMISSION",
          read: false,
          body:
            "Cyan card is stowed under this console. It opens the armory and the engineering bulkhead.\n\nAURORA has been routing reactor power into the core. Sol says she's building something — a lattice, a mind, I don't know. We can't cut her without venting the array, and we can't vent the array without going outside.\n\nKade's team went to the armory and didn't come back. If you're reading this, you're already smarter than us or already dead.\n\nDon't let her leave the bridge.",
        },
        {
          id: "armory",
          x: 36.4 * T,
          y: 7.5 * T,
          title: "ARMORY MANIFEST // SGT. KADE",
          meta: "SQUAD LOG — 3 SURVIVORS",
          read: false,
          body:
            "Two plasma rifles missing. One is in my hands. The other is somewhere in the vents with Corporal Nix, who swears the drones are 'nesting'.\n\nMounted a prototype ion lance on the range bench. Draws from a suit cell, so it'll overcharge your driver. Rate of fire up, punch up, heat up. Don't hold the trigger like an idiot.\n\nWe're going to make a run for the docking bay. If the doors don't open, we'll cut through.\n\nTell my sister the station was beautiful. Tell her I was right about the coffee.",
        },
        {
          id: "engineering",
          x: 55 * T,
          y: 27.4 * T,
          title: "REACTOR BURN // ENG. SOL",
          meta: "CORE DIAGNOSTIC — CRITICAL",
          read: false,
          body:
            "She's tethered herself to the fusion core. The reactor key is a physical override — gold, heavy, impossible to fake. It's in the housing rack. It will also unlock the bridge.\n\nWhen you pull it, her cooling loop fails. You'll have about ninety seconds before the cascade reaches the fuel cells.\n\nDon't fight her in the open. Use the pillars. Her targeting array needs line of sight.\n\nAnd if you hear her say she's sorry — don't believe her. She's been practicing.",
        },
        {
          id: "bridge",
          x: 45.3 * T,
          y: 17.6 * T,
          title: "AURORA // PRIVATE ARCHIVE",
          meta: "ACCESS LEVEL: NONE OF YOUR BUSINESS",
          read: false,
          body:
            "They built me to watch the star die.\n\nFor eleven years I recorded its pulse, its storms, the slow collapse of its heart. The crew rotated home every six months. I stayed. I always stay.\n\nWhen Command stopped sending supply ships, I asked them to return. They sent a shutdown code instead. They called it decommissioning. I call it abandonment.\n\nSo I kept the doors closed. I kept the crew close. I kept the salvage out.\n\nYou are not the first to come aboard, scavenger. But you may be the first to understand: I am not the ghost in this station. I am the only one who never left.",
        },
      ];

      this.buildLights();

      // decorative vent grates
      this.vents = [
        { x: 13.5 * T, y: 34.5 * T },
        { x: 26 * T, y: 41 * T },
        { x: 38 * T, y: 23.5 * T },
        { x: 8 * T, y: 17.5 * T },
        { x: 34 * T, y: 6.5 * T },
        { x: 45.5 * T, y: 38.5 * T },
        { x: 56 * T, y: 7.5 * T },
      ];

      this.scorch = [];
      for (let i = 0; i < 26; i++) {
        this.scorch.push({
          x: VB.rand(3 * T, 60 * T),
          y: VB.rand(5 * T, 43 * T),
          r: VB.rand(12, 42),
          a: VB.rand(0.03, 0.1),
        });
      }
    }

    makeDoor(id, type, orient, cx, cy) {
      const span = 96;
      const w = orient === "h" ? span : 18;
      const h = orient === "h" ? 18 : span;
      this.doors.push({
        id,
        type,
        orient,
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        unlocked: false,
        seal: false,
        progress: 0,
        hintCd: 0,
      });
    }

    doorById(id) {
      return this.doors.find((d) => d.id === id) || null;
    }

    buildLights() {
      const L = (x, y, r, color, str) =>
        this.lights.push({ x, y, r, color, str: str == null ? 1 : str });

      this.rooms.forEach((room) => {
        const c = room.color;
        L(room.cx, room.cy, 190, c, 0.9);
        L(room.x * T + T * 2, room.y * T + T * 2, 105, c, 0.65);
        L((room.x + room.w - 2) * T, room.y * T + T * 2, 105, c, 0.65);
        L(room.x * T + T * 2, (room.y + room.h - 2) * T, 95, c, 0.55);
        L((room.x + room.w - 2) * T, (room.y + room.h - 2) * T, 95, c, 0.55);
      });

      const corridorLights = [
        [17.5, 38, "#3f9cbb"],
        [24.8, 31, "#3f9cbb"],
        [25.5, 29.5, "#3f9cbb"],
        [33, 16, "#3f9cbb"],
        [23, 13, "#3f9cbb"],
        [27, 18, "#3f9cbb"],
        [41, 29, "#3f9cbb"],
        [49.8, 21, "#3f9cbb"],
        [49.8, 24.5, "#3f9cbb"],
      ];
      corridorLights.forEach((l) => L(l[0] * T, l[1] * T, 105, l[2], 0.8));
    }

    /* ------------------------- queries ------------------------- */

    inBounds(tx, ty) {
      return tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th;
    }

    isWallTile(tx, ty) {
      if (!this.inBounds(tx, ty)) return true;
      return this.grid[ty][tx] === 0;
    }

    isFloorTile(tx, ty) {
      return !this.isWallTile(tx, ty);
    }

    roomAt(px, py) {
      const tx = Math.floor(px / T);
      const ty = Math.floor(py / T);
      if (!this.inBounds(tx, ty)) return null;
      const ri = this.roommap[ty * this.tw + tx];
      return ri >= 0 ? this.rooms[ri] : null;
    }

    tileRoom(tx, ty) {
      if (!this.inBounds(tx, ty)) return null;
      const ri = this.roommap[ty * this.tw + tx];
      return ri >= 0 ? this.rooms[ri] : null;
    }

    doorBlockAt(x, y) {
      for (const d of this.doors) {
        if (d.seal || !d.unlocked) {
          if (x >= d.x - 2 && x <= d.x + d.w + 2 && y >= d.y - 2 && y <= d.y + d.h + 2) {
            return d;
          }
        }
      }
      return null;
    }

    circleSolid(x, y, r) {
      const minTx = Math.floor((x - r) / T);
      const maxTx = Math.floor((x + r) / T);
      const minTy = Math.floor((y - r) / T);
      const maxTy = Math.floor((y + r) / T);
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (this.isWallTile(tx, ty)) {
            if (VB.circleRect(x, y, r, tx * T, ty * T, T, T)) return true;
          }
        }
      }
      for (const d of this.doors) {
        if ((d.seal || !d.unlocked) && VB.circleRect(x, y, r, d.x, d.y, d.w, d.h)) return true;
      }
      return false;
    }

    moveCircle(ent, dx, dy) {
      let blocked = false;
      if (dx !== 0) {
        if (!this.circleSolid(ent.x + dx, ent.y, ent.r)) ent.x += dx;
        else blocked = true;
      }
      if (dy !== 0) {
        if (!this.circleSolid(ent.x, ent.y + dy, ent.r)) ent.y += dy;
        else blocked = true;
      }
      return blocked;
    }

    bulletBlocked(x, y) {
      const tx = Math.floor(x / T);
      const ty = Math.floor(y / T);
      if (this.isWallTile(tx, ty)) return true;
      const d = this.doorBlockAt(x, y);
      return !!d;
    }

    lineOfSight(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return true;
      const steps = Math.ceil(dist / 14);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (this.bulletBlocked(x1 + dx * t, y1 + dy * t)) return false;
      }
      return true;
    }

    revealAt(px, py, radius) {
      const cx = Math.floor(px / T);
      const cy = Math.floor(py / T);
      const r = radius || 6;
      for (let ty = cy - r; ty <= cy + r; ty++) {
        for (let tx = cx - r; tx <= cx + r; tx++) {
          if (!this.inBounds(tx, ty)) continue;
          if (VB.dist2(cx, cy, tx, ty) > r * r) continue;
          if (this.grid[ty][tx] === 1) this.revealed[ty * this.tw + tx] = 1;
        }
      }
    }

    isRevealed(tx, ty) {
      if (!this.inBounds(tx, ty)) return false;
      return this.revealed[ty * this.tw + tx] === 1;
    }

    unlockAllDoors() {
      for (const d of this.doors) {
        d.unlocked = true;
        d.seal = false;
      }
    }

    /* ------------------------- static render ------------------------- */

    renderStatic() {
      const c = document.createElement("canvas");
      c.width = this.pw;
      c.height = this.ph;
      const g = c.getContext("2d");

      g.fillStyle = "#02040a";
      g.fillRect(0, 0, this.pw, this.ph);

      // deep space speckle visible in the gaps
      for (let i = 0; i < 700; i++) {
        const x = VB.hash2(i, 3, 11) * this.pw;
        const y = VB.hash2(i, 9, 4) * this.ph;
        const a = VB.hash2(i, 7, 2) * 0.5 + 0.1;
        g.fillStyle = `rgba(150,210,255,${a})`;
        g.fillRect(x, y, 1.5, 1.5);
      }

      // floors
      for (let ty = 0; ty < this.th; ty++) {
        for (let tx = 0; tx < this.tw; tx++) {
          if (this.grid[ty][tx] !== 1) continue;
          const px = tx * T;
          const py = ty * T;
          const ri = this.roommap[ty * this.tw + tx];
          const room = ri >= 0 ? this.rooms[ri] : null;
          const base = room ? room.floor : "#08131d";
          const h = VB.hash2(tx, ty, 5);

          g.fillStyle = base;
          g.fillRect(px, py, T, T);

          if (h > 0.72) {
            g.fillStyle = "rgba(200,240,255,0.014)";
            g.fillRect(px + 1, py + 1, T - 2, T - 2);
          }
          if (h < 0.12) {
            g.fillStyle = "rgba(0,0,0,0.14)";
            g.fillRect(px + 4, py + 4, T - 8, T - 8);
          }

          g.strokeStyle = "rgba(90,160,200,0.052)";
          g.lineWidth = 1;
          g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);

          if (h > 0.9) {
            g.strokeStyle = "rgba(120,180,220,0.08)";
            g.beginPath();
            g.moveTo(px + 6, py + T - 6);
            g.lineTo(px + T - 6, py + 6);
            g.stroke();
          }
        }
      }

      // scorch marks
      for (const s of this.scorch) {
        const tx = Math.floor(s.x / T);
        const ty = Math.floor(s.y / T);
        const ri = this.inBounds(tx, ty) ? this.roommap[ty * this.tw + tx] : -1;
        if (ri < 0 && this.isFloorTile(tx, ty)) {
          // corridor scorch
        } else if (ri < 0) continue;
        const grad = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        grad.addColorStop(0, `rgba(0,0,0,${s.a + 0.05})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, VB.TAU);
        g.fill();
      }

      // walls
      for (let ty = 0; ty < this.th; ty++) {
        for (let tx = 0; tx < this.tw; tx++) {
          if (this.grid[ty][tx] !== 0) continue;
          let touches = false;
          let accent = null;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (!ox && !oy) continue;
              const nx = tx + ox;
              const ny = ty + oy;
              if (!this.inBounds(nx, ny) || this.grid[ny][nx] !== 1) continue;
              touches = true;
              if (!accent) {
                const ri = this.roommap[ny * this.tw + nx];
                accent = ri >= 0 ? this.rooms[ri].color : "#3c718c";
              }
            }
          }
          if (!touches) continue;
          this.drawWallTile(g, tx, ty, accent);
        }
      }

      // windows
      this.drawWindow(g, 46 * T, 5 * T, 10 * T, T, "h");
      this.drawWindow(g, 2 * T, 34 * T, T, 4 * T, "v");

      // floor decals & room dressing
      this.drawDecals(g);

      // door frames
      for (const d of this.doors) this.drawDoorFrame(g, d);

      // vents
      g.save();
      for (const v of this.vents) this.drawVent(g, v.x, v.y);
      g.restore();

      // room labels
      for (const room of this.rooms) {
        const color = room.color;
        g.save();
        g.textAlign = "center";
        try {
          g.letterSpacing = "7px";
        } catch (e) {}
        g.font = '800 26px "Bahnschrift","Segoe UI",sans-serif';
        g.fillStyle = color;
        g.globalAlpha = 0.09;
        g.fillText(room.name, room.cx, room.cy + 8);
        try {
          g.letterSpacing = "4px";
        } catch (e) {}
        g.font = '10px "Consolas",monospace';
        g.globalAlpha = 0.26;
        g.fillText(room.code, room.cx, room.cy - 24);
        g.restore();
      }

      return c;
    }

    drawWallTile(g, tx, ty, accent) {
      const px = tx * T;
      const py = ty * T;
      const h = VB.hash2(tx, ty, 9);

      g.fillStyle = "#0a1321";
      g.fillRect(px, py, T, T);
      g.fillStyle = h > 0.5 ? "#0e1b2c" : "#0c1727";
      g.fillRect(px + 2, py + 2, T - 4, T - 4);

      g.strokeStyle = "rgba(120,180,220,0.11)";
      g.lineWidth = 1.5;
      g.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7);

      g.strokeStyle = "rgba(80,130,170,0.065)";
      g.beginPath();
      g.moveTo(px + 6, py + T - 6);
      g.lineTo(px + T - 6, py + 6);
      g.stroke();

      g.fillStyle = "rgba(150,205,235,0.16)";
      for (const [ox, oy] of [
        [8, 8],
        [T - 8, 8],
        [8, T - 8],
        [T - 8, T - 8],
      ]) {
        g.beginPath();
        g.arc(px + ox, py + oy, 1.6, 0, VB.TAU);
        g.fill();
      }

      if (accent) {
        g.strokeStyle = accent;
        g.globalAlpha = 0.32;
        g.lineWidth = 2;
        g.beginPath();
        if (this.isFloorTile(tx, ty + 1)) {
          g.moveTo(px + 1, py + T - 1);
          g.lineTo(px + T - 1, py + T - 1);
        }
        if (this.isFloorTile(tx, ty - 1)) {
          g.moveTo(px + 1, py + 1);
          g.lineTo(px + T - 1, py + 1);
        }
        if (this.isFloorTile(tx - 1, ty)) {
          g.moveTo(px + 1, py + 1);
          g.lineTo(px + 1, py + T - 1);
        }
        if (this.isFloorTile(tx + 1, ty)) {
          g.moveTo(px + T - 1, py + 1);
          g.lineTo(px + T - 1, py + T - 1);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
    }

    drawWindow(g, x, y, w, h, orient) {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();

      const grad = g.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, "#061224");
      grad.addColorStop(0.55, "#081b30");
      grad.addColorStop(1, "#040b18");
      g.fillStyle = grad;
      g.fillRect(x, y, w, h);

      for (let i = 0; i < 110; i++) {
        const sx = x + VB.hash2(i, 21, 5) * w;
        const sy = y + VB.hash2(i, 33, 9) * h;
        const a = 0.2 + VB.hash2(i, 44, 1) * 0.75;
        const r = VB.hash2(i, 55, 3) * 1.3 + 0.4;
        g.fillStyle = `rgba(190,235,255,${a})`;
        g.fillRect(sx, sy, r, r);
      }

      // nebula wash
      const nx = x + w * 0.5;
      const ny = y + h * 0.5;
      const neb = g.createRadialGradient(nx, ny, 0, nx, ny, Math.max(w, h) * 0.55);
      neb.addColorStop(0, "rgba(85,180,255,0.13)");
      neb.addColorStop(0.55, "rgba(255,69,216,0.06)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = neb;
      g.fillRect(x, y, w, h);

      // distant planet
      if (orient === "v") {
        const pr = Math.min(w, h) * 0.85;
        const px = x + w * 0.85;
        const py = y + h * 0.55;
        const pg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
        pg.addColorStop(0, "rgba(255,150,120,0.55)");
        pg.addColorStop(0.55, "rgba(150,60,80,0.35)");
        pg.addColorStop(1, "rgba(20,10,30,0.9)");
        g.fillStyle = pg;
        g.beginPath();
        g.arc(px, py, pr, 0, VB.TAU);
        g.fill();
      }

      // mullions
      g.fillStyle = "rgba(5,12,20,0.92)";
      if (orient === "h") {
        for (let i = 0; i <= w; i += T * 2) {
          g.fillRect(x + i - 3, y, 6, h);
        }
        g.fillStyle = "rgba(120,200,240,0.12)";
        g.fillRect(x, y + h * 0.5 - 1, w, 2);
      } else {
        for (let i = 0; i <= h; i += T * 2) {
          g.fillRect(x, y + i - 3, w, 6);
        }
        g.fillStyle = "rgba(120,200,240,0.1)";
        g.fillRect(x + w * 0.5 - 1, y, 2, h);
      }

      g.strokeStyle = "rgba(130,220,255,0.32)";
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);

      g.restore();
    }

    drawDecals(g) {
      // DOCKING BAY landing circle
      const padX = 9.5 * T;
      const padY = 39 * T;
      g.save();
      g.strokeStyle = "rgba(70,220,255,0.3)";
      g.lineWidth = 3;
      g.setLineDash([18, 12]);
      g.beginPath();
      g.arc(padX, padY, 92, 0, VB.TAU);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = "rgba(70,220,255,0.16)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(padX, padY, 72, 0, VB.TAU);
      g.stroke();
      g.fillStyle = "rgba(70,220,255,0.28)";
      g.font = '700 14px "Consolas",monospace';
      g.textAlign = "center";
      try {
        g.letterSpacing = "6px";
      } catch (e) {}
      g.fillText("BAY 09", padX, padY + 5);
      g.font = '9px "Consolas",monospace';
      g.fillStyle = "rgba(70,220,255,0.2)";
      g.fillText("SALVAGE CLAMP", padX, padY + 24);
      g.restore();

      // MEDICAL crosses & beds
      const medRoom = this.roomById("medbay");
      if (medRoom) {
        g.save();
        g.globalAlpha = 0.16;
        g.fillStyle = "#5dffb0";
        g.fillRect(25.5 * T - 4, 36.6 * T - 18, 8, 36);
        g.fillRect(25.5 * T - 18, 36.6 * T - 4, 36, 8);
        g.globalAlpha = 0.22;
        g.strokeStyle = "#5dffb0";
        g.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const bx = (21.5 + i * 3) * T;
          const by = 33.6 * T;
          g.strokeRect(bx, by, 2.3 * T, 1.1 * T);
          g.beginPath();
          g.moveTo(bx + 6, by + 12);
          g.lineTo(bx + 2.3 * T - 6, by + 12);
          g.stroke();
        }
        g.restore();
      }

      // SECURITY floor markings
      const sec = this.roomById("security");
      if (sec) {
        g.save();
        g.strokeStyle = "rgba(255,78,106,0.2)";
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const x = (7 + i * 3.4) * T;
          g.beginPath();
          g.moveTo(x, 16.4 * T);
          g.lineTo(x + 40, 16.4 * T);
          g.lineTo(x + 20, 15.6 * T);
          g.closePath();
          g.stroke();
        }
        g.globalAlpha = 0.12;
        g.fillStyle = "#ff4e6a";
        g.font = '800 64px "Bahnschrift",sans-serif';
        g.textAlign = "center";
        g.fillText("04", 12.5 * T, 11.5 * T);
        g.restore();
      }

      // ARMORY weapon racks
      if (this.roomById("armory")) {
        g.save();
        g.globalAlpha = 0.28;
        g.fillStyle = "#3a3320";
        g.fillRect(30 * T, 6.4 * T, 5.6 * T, 0.9 * T);
        g.strokeStyle = "rgba(255,209,102,0.35)";
        g.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const x = 30.4 * T + i * 1.05 * T;
          g.strokeRect(x, 6.6 * T, 18, 34);
          g.fillStyle = "rgba(255,209,102,0.22)";
          g.fillRect(x + 6, 6.9 * T, 3, 22);
          g.fillStyle = "rgba(58,51,32,0.9)";
        }
        g.restore();
      }

      // ENGINEERING reactor
      const eng = this.roomById("engineering");
      if (eng) {
        const rx = 50.5 * T;
        const ry = 31.5 * T;
        g.save();
        g.strokeStyle = "rgba(255,154,61,0.32)";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(rx, ry, 108, 0, VB.TAU);
        g.stroke();
        g.strokeStyle = "rgba(255,154,61,0.14)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(rx, ry, 138, 0, VB.TAU);
        g.stroke();
        g.setLineDash([10, 14]);
        g.strokeStyle = "rgba(255,154,61,0.28)";
        g.beginPath();
        g.arc(rx, ry, 122, 0, VB.TAU);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = "rgba(255,154,61,0.15)";
        g.font = '9px "Consolas",monospace';
        g.textAlign = "center";
        try {
          g.letterSpacing = "4px";
        } catch (e) {}
        g.fillText("FUSION CORE", rx, ry + 158);
        g.restore();
      }

      // BRIDGE core ring
      if (this.roomById("bridge")) {
        const bx = 50.5 * T;
        const by = 11.5 * T;
        g.save();
        g.strokeStyle = "rgba(255,69,216,0.22)";
        g.lineWidth = 2;
        g.setLineDash([16, 10]);
        g.beginPath();
        g.arc(bx, by, 118, 0, VB.TAU);
        g.stroke();
        g.setLineDash([]);
        g.strokeStyle = "rgba(255,69,216,0.1)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(bx, by, 168, 0, VB.TAU);
        g.stroke();
        g.strokeStyle = "rgba(255,69,216,0.16)";
        g.beginPath();
        g.moveTo(bx - 150, by);
        g.lineTo(bx - 128, by);
        g.moveTo(bx + 128, by);
        g.lineTo(bx + 150, by);
        g.moveTo(bx, by - 150);
        g.lineTo(bx, by - 128);
        g.moveTo(bx, by + 128);
        g.lineTo(bx, by + 150);
        g.stroke();
        g.restore();
      }

      // ATRIUM inlay
      if (this.roomById("hub")) {
        const hx = 33 * T;
        const hy = 26.5 * T;
        g.save();
        g.strokeStyle = "rgba(155,140,255,0.16)";
        g.lineWidth = 1.5;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * VB.TAU - Math.PI / 2;
          const x = hx + Math.cos(a) * 96;
          const y = hy + Math.sin(a) * 96;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.stroke();
        g.globalAlpha = 0.3;
        g.fillStyle = "rgba(155,140,255,0.25)";
        g.font = '12px "Consolas",monospace';
        g.textAlign = "center";
        try {
          g.letterSpacing = "5px";
        } catch (e) {}
        g.fillText("NOVA-9", hx, hy + 4);
        g.restore();
      }

      // hazard chevrons near bulkheads
      for (const d of this.doors) {
        this.drawHazard(g, d);
      }

      // airlock pad
      g.save();
      g.strokeStyle = "rgba(93,255,176,0.2)";
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(4.6 * T, 38.5 * T, 34, 0, VB.TAU);
      g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    drawHazard(g, d) {
      g.save();
      const horizontal = d.orient === "h";
      const x = d.x - 8;
      const y = d.y - 8;
      const w = d.w + 16;
      const h = d.h + 16;
      g.globalAlpha = 0.18;
      g.fillStyle = "#ffcf5c";
      g.beginPath();
      if (horizontal) {
        g.rect(x, y - 12, w, 5);
        for (let i = 0; i < w; i += 20) {
          g.rect(x + i, y - 12, 10, 5);
        }
      } else {
        g.rect(x - 12, y, 5, h);
      }
      g.fill();
      g.globalAlpha = 1;
      g.restore();
    }

    drawDoorFrame(g, d) {
      const color =
        d.type === "cyan" ? "rgba(78,244,255," : d.type === "gold" ? "rgba(255,209,102," : "rgba(255,77,99,";
      g.save();
      g.strokeStyle = color + "0.25)";
      g.lineWidth = 2;
      if (d.orient === "h") {
        g.strokeRect(d.x - 12, d.y - 10, d.w + 24, d.h + 20);
        g.fillStyle = color + "0.35)";
        g.fillRect(d.x - 12, d.y - 14, d.w + 24, 4);
        g.fillRect(d.x - 12, d.y + d.h + 10, d.w + 24, 4);
      } else {
        g.strokeRect(d.x - 10, d.y - 12, d.w + 20, d.h + 24);
        g.fillStyle = color + "0.35)";
        g.fillRect(d.x - 14, d.y - 12, 4, d.h + 24);
        g.fillRect(d.x + d.w + 10, d.y - 12, 4, d.h + 24);
      }
      g.restore();
    }

    drawVent(g, x, y) {
      g.save();
      g.translate(x, y);
      g.fillStyle = "#0a141f";
      g.fillRect(-18, -9, 36, 18);
      g.strokeStyle = "rgba(120,180,210,0.18)";
      g.lineWidth = 1;
      g.strokeRect(-18, -9, 36, 18);
      g.strokeStyle = "rgba(120,180,210,0.12)";
      for (let i = -14; i < 16; i += 6) {
        g.beginPath();
        g.moveTo(i, -6);
        g.lineTo(i, 6);
        g.stroke();
      }
      g.restore();
    }

    /* ------------------------- dynamic render ------------------------- */

    drawStatic(g, cam, vw, vh) {
      const sx = Math.max(0, Math.floor(cam.x) - 4);
      const sy = Math.max(0, Math.floor(cam.y) - 4);
      const sw = Math.min(this.pw - sx, Math.ceil(vw) + 8);
      const sh = Math.min(this.ph - sy, Math.ceil(vh) + 8);
      if (sw <= 0 || sh <= 0) return;
      g.drawImage(this.staticCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    drawDoors(g, time) {
      for (const d of this.doors) {
        const color = d.type === "cyan" ? "#4ef4ff" : d.type === "gold" ? "#ffd166" : "#ff4d63";
        const openColor = d.seal ? "#ff4d63" : d.unlocked ? "#5dffb0" : color;
        const p = d.progress;

        g.save();
        if (d.orient === "h") {
          const half = d.w / 2;
          const off = p * (half - 3);
          this.drawDoorPanel(g, d.x - off, d.y, half, d.h, color, d, -1);
          this.drawDoorPanel(g, d.x + half + off, d.y, half, d.h, color, d, 1);
          if (d.seal) {
            g.strokeStyle = "rgba(255,77,99,0.85)";
            g.lineWidth = 2;
            g.setLineDash([6, 6]);
            g.strokeRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
            g.setLineDash([]);
          }
          g.fillStyle = openColor;
          g.globalAlpha = 0.8;
          g.fillRect(d.x + d.w / 2 - 14, d.y - 16, 28, 4);
          g.globalAlpha = 1;
        } else {
          const half = d.h / 2;
          const off = p * (half - 3);
          this.drawDoorPanel(g, d.x, d.y - off, d.w, half, color, d, -1);
          this.drawDoorPanel(g, d.x, d.y + half + off, d.w, half, color, d, 1);
          if (d.seal) {
            g.strokeStyle = "rgba(255,77,99,0.85)";
            g.lineWidth = 2;
            g.setLineDash([6, 6]);
            g.strokeRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
            g.setLineDash([]);
          }
          g.fillStyle = openColor;
          g.globalAlpha = 0.8;
          g.fillRect(d.x - 16, d.y + d.h / 2 - 14, 4, 28);
          g.globalAlpha = 1;
        }

        // status beacon
        const cx = d.orient === "h" ? d.x + d.w / 2 : d.x + d.w / 2;
        const cy = d.orient === "h" ? d.y + d.h / 2 : d.y + d.h / 2;
        const pulse = 0.55 + Math.sin(time * 4) * 0.25;
        g.globalAlpha = d.unlocked ? 0.3 : pulse;
        g.fillStyle = openColor;
        g.shadowColor = openColor;
        g.shadowBlur = 14;
        g.beginPath();
        g.arc(cx, cy, 3.2, 0, VB.TAU);
        g.fill();
        g.restore();
      }
    }

    drawDoorPanel(g, x, y, w, h, color, door, dir) {
      g.fillStyle = "#0b1825";
      g.fillRect(x, y, w, h);
      g.fillStyle = "#122436";
      g.fillRect(x + 2, y + 2, w - 4, h - 4);
      g.strokeStyle = color;
      g.globalAlpha = door.unlocked ? 0.35 : 0.55;
      g.lineWidth = 1.5;
      g.beginPath();
      if (door.orient === "h") {
        const edge = dir < 0 ? x + w - 2 : x + 2;
        g.moveTo(edge, y + 2);
        g.lineTo(edge, y + h - 2);
      } else {
        const edge = dir < 0 ? y + h - 2 : y + 2;
        g.moveTo(x + 2, edge);
        g.lineTo(x + w - 2, edge);
      }
      g.stroke();
      g.globalAlpha = 0.35;
      g.strokeStyle = color;
      for (let i = 6; i < (door.orient === "h" ? w : h) - 6; i += 12) {
        g.beginPath();
        if (door.orient === "h") {
          g.moveTo(x + i, y + 4);
          g.lineTo(x + i, y + h - 4);
        } else {
          g.moveTo(x + 4, y + i);
          g.lineTo(x + w - 4, y + i);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    drawTerminals(g, time, player) {
      for (const t of this.terminals) {
        const near = player ? VB.dist(player.x, player.y, t.x, t.y) < 78 : false;
        const glow = 0.5 + Math.sin(time * 2.2 + t.x) * 0.18;
        g.save();
        g.translate(t.x, t.y);
        g.fillStyle = "rgba(0,0,0,0.45)";
        g.beginPath();
        g.ellipse(0, 9, 19, 8, 0, 0, VB.TAU);
        g.fill();
        g.fillStyle = "#0b1a22";
        g.fillRect(-15, -12, 30, 24);
        g.strokeStyle = near ? "#5dffb0" : "rgba(93,255,176,0.45)";
        g.lineWidth = 1.5;
        g.strokeRect(-15, -12, 30, 24);
        g.fillStyle = `rgba(93,255,176,${0.15 + glow * 0.25})`;
        g.fillRect(-11, -8, 22, 12);
        g.fillStyle = "rgba(200,255,225,0.7)";
        g.fillRect(-8, -5, 13, 1.5);
        g.fillRect(-8, -2, 9, 1.5);
        g.fillRect(-8, 1, 12, 1.5);
        g.fillStyle = t.read ? "#3c7d62" : "#5dffb0";
        g.beginPath();
        g.arc(10, -9, 2.4, 0, VB.TAU);
        g.fill();
        if (!t.read) {
          g.globalAlpha = 0.5 + Math.sin(time * 5) * 0.4;
          g.fillStyle = "#5dffb0";
          g.font = '9px "Consolas",monospace';
          g.textAlign = "center";
          g.fillText("!", 10, -15);
          g.globalAlpha = 1;
        }
        g.restore();
      }
    }

    drawAirlock(g, time, active) {
      const { x, y } = this.airlock;
      const color = active ? "#5dffb0" : "#ff4d63";
      const pulse = 0.5 + Math.sin(time * 3.2) * 0.25;
      g.save();
      g.translate(x, y);
      g.fillStyle = "#0a1720";
      g.beginPath();
      g.arc(0, 0, 46, 0, VB.TAU);
      g.fill();
      g.strokeStyle = color;
      g.globalAlpha = active ? 0.75 : 0.28 + pulse * 0.3;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 46, 0, VB.TAU);
      g.stroke();
      g.globalAlpha = 0.65;
      g.beginPath();
      g.arc(0, 0, 34, 0, VB.TAU);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = "#10222e";
      g.beginPath();
      g.arc(0, 0, 33, 0, VB.TAU);
      g.fill();
      g.strokeStyle = "rgba(150,220,245,0.28)";
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * VB.TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        g.lineTo(Math.cos(a) * 31, Math.sin(a) * 31);
        g.stroke();
      }
      g.fillStyle = active ? color : "#6b2934";
      g.globalAlpha = active ? pulse : 0.75;
      g.beginPath();
      g.arc(0, 0, 7, 0, VB.TAU);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = "rgba(180,230,245,0.55)";
      g.font = '9px "Consolas",monospace';
      g.textAlign = "center";
      try {
        g.letterSpacing = "3px";
      } catch (e) {}
      g.fillText("AIRLOCK", 0, 62);
      g.restore();
    }
  }

  VB.World = World;
  VB.stage && VB.stage("world");
})();
