(function () {
  "use strict";
  const VB = window.VB;
  const TAU = VB.TAU;

  function setLS(g, v) {
    try {
      g.letterSpacing = v + "px";
    } catch (e) {}
  }

  function panel(g, x, y, w, h, accent, fill) {
    g.beginPath();
    g.moveTo(x + 10, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.lineTo(x, y + 10);
    g.closePath();
    g.fillStyle = fill || "rgba(3,11,19,0.78)";
    g.fill();
    g.strokeStyle = accent || "rgba(78,244,255,0.24)";
    g.lineWidth = 1;
    g.stroke();

    g.strokeStyle = accent || "rgba(78,244,255,0.24)";
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(x + 10, y + 0.5);
    g.lineTo(x + 56, y + 0.5);
    g.stroke();
    g.globalAlpha = 1;
  }

  function text(g, str, x, y, size, color, align, spacing, font, weight) {
    g.font = `${weight || 500} ${size}px ${font || '"Consolas","Courier New",monospace'}`;
    g.fillStyle = color;
    g.textAlign = align || "left";
    setLS(g, spacing || 0);
    g.fillText(str, x, y);
    setLS(g, 0);
  }

  function bar(g, x, y, w, h, frac, colorA, colorB, bg) {
    g.fillStyle = bg || "rgba(2,8,14,0.9)";
    g.fillRect(x, y, w, h);
    const grad = g.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    g.fillStyle = grad;
    g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    g.strokeStyle = "rgba(180,240,255,0.12)";
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function touchLayout(game) {
    const geo = game.touch ? game.touch.geo : null;
    const W = game.width;
    const H = game.height;
    const r = geo ? geo.r : 52;
    const bandTop = H - 20 - 2 * r;
    const slotH = 48;
    const dialogH = 52;

    if (!geo) {
      return { slotX: 22, slotY: 156, slotW: W - 44, slotH, dialogH, dialogY: bandTop - dialogH - 8, toastY: bandTop - dialogH - 38 };
    }

    const dashLeft = geo.aimHome.x - (geo.r + geo.br + 14) - geo.br;
    const usable = dashLeft - (geo.moveHome.x + geo.r);

    if (usable >= 260) {
      const slotW = Math.min(340, usable - 12);
      const slotY = bandTop + 10;
      const dialogY = slotY - dialogH - 8;
      return { slotX: W / 2 - slotW / 2, slotY, slotW, slotH, dialogH, dialogY, toastY: dialogY - 30 };
    }

    const slotW = Math.min(300, W - 44);
    const slotY = 156;
    const dialogY = Math.max(slotY + slotH + 8, bandTop - dialogH - 8);
    return { slotX: 22, slotY, slotW, slotH, dialogH, dialogY, toastY: dialogY - 30 };
  }

  function drawPlayerPanel(g, game) {
    const p = game.player;
    const W = game.width;
    const touch = !!game.touchMode;
    const w = W < 1100 ? 268 : 306;
    const x = 22;
    const y = 22;
    const h = touch ? 126 : 110;

    panel(g, x, y, w, h);

    text(g, `${p.name} // ${p.role}`, x + 16, y + 20, 9.5, p.accent, "left", 2.2);
    text(
      g,
      `HULL ${Math.ceil(p.hp)}`,
      x + 16,
      y + 38,
      8,
      "#ff8b9b",
      "left",
      1.6
    );
    text(
      g,
      `${Math.ceil(p.hp)} / ${p.maxHp}`,
      x + w - 16,
      y + 38,
      9,
      "#ffd6dc",
      "right",
      1
    );

    bar(g, x + 16, y + 44, w - 32, 11, p.hp / p.maxHp, "#ff4d63", "#ff9a6b");
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let i = 1; i < 10; i++) {
      g.fillRect(x + 16 + ((w - 32) / 10) * i, y + 44, 1, 11);
    }

    text(
      g,
      `${Math.ceil(p.shield)} / ${p.maxShield}`,
      x + w - 16,
      y + 67,
      8,
      "#9defff",
      "right",
      1
    );
    bar(g, x + 16, y + 72, w - 32, 6, p.shield / p.maxShield, "#1d8aa3", "#5ef6ff");

    const dashReady = p.dashCooldown <= 0;
    const dashFrac = 1 - Math.min(1, p.dashCooldown / p.dashCdMax);
    text(
      g,
      dashReady ? "DASH READY" : "DASH CHARGING",
      x + 16,
      y + 94,
      8,
      dashReady ? "#5ef6ff" : "#547084",
      "left",
      1.6
    );
    g.fillStyle = "rgba(40,90,110,0.5)";
    g.fillRect(x + 108, y + 88, w - 124, 5);
    g.fillStyle = dashReady ? "#5ef6ff" : "#2f7183";
    g.fillRect(x + 108, y + 88, (w - 124) * dashFrac, 5);

    if (p.weaponLevel > 1) {
      g.fillStyle = "rgba(255,209,102,0.8)";
      g.fillRect(x + 108, y + 97, 46, 2);
    }

    if (touch) {
      const lvl = p.weaponLevel > 1;
      g.strokeStyle = "rgba(78,244,255,0.14)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 12, y + 106.5);
      g.lineTo(x + w - 12, y + 106.5);
      g.stroke();

      text(
        g,
        lvl ? p.gun.mk2 : p.gun.name,
        x + 16,
        y + 120,
        7.5,
        lvl ? "#ffd166" : p.accent,
        "left",
        1.2
      );

      let chipX = x + 16 + (lvl ? 92 : 76);
      const owned = [p.keycards.cyan, p.keycards.gold];
      const colors = ["#4ef4ff", "#ffd166"];
      const labels = ["C", "G"];
      for (let i = 0; i < 2; i++) {
        g.save();
        g.globalAlpha = owned[i] ? 1 : 0.38;
        g.fillStyle = owned[i] ? colors[i] + "22" : "rgba(6,14,22,0.6)";
        g.strokeStyle = owned[i] ? colors[i] : "rgba(130,170,190,0.5)";
        g.lineWidth = 1;
        VB.roundRect(g, chipX, y + 110, 13, 13, 3);
        g.fill();
        g.stroke();
        text(g, labels[i], chipX + 6.5, y + 119.5, 7, owned[i] ? colors[i] : "#718b9c", "center", 0);
        g.restore();
        chipX += 17;
      }

      text(
        g,
        `LOGS ${game.logsRead}/5 · KILLS ${game.kills}`,
        x + w - 16,
        y + 120,
        7.5,
        "#5dffb0",
        "right",
        1
      );
    }
  }

  function drawWeaponPanel(g, game) {
    if (game.touchMode) return;
    const p = game.player;
    const W = game.width;
    const H = game.height;
    const w = W < 1100 ? 268 : 306;
    const x = 22;
    const y = H - 104;
    const h = 82;

    panel(g, x, y, w, h);

    const mk2 = p.weaponLevel > 1;
    const dmg = Math.round(p.gun.dmg * (mk2 ? 1.45 : 1));
    const pellets = p.gun.pellets + (mk2 && p.gun.pellets > 1 ? 2 : 0);
    const rate = (1 / (p.gun.rate * (mk2 ? 0.78 : 1))).toFixed(1);

    text(
      g,
      `${mk2 ? p.gun.mk2 : p.gun.name} // ${mk2 ? "MK II" : "MK I"}`,
      x + 16,
      y + 21,
      10,
      mk2 ? "#ffd166" : p.accent,
      "left",
      2
    );
    text(
      g,
      `DMG ${dmg}${pellets > 1 ? "×" + pellets : ""}   •   RATE ${rate}/s`,
      x + 16,
      y + 37,
      8,
      "#547084",
      "left",
      1.1
    );

    const cardW = 54;
    const gap = 6;
    const cy = y + 47;
    for (let i = 0; i < 2; i++) {
      const owned = i === 0 ? p.keycards.cyan : p.keycards.gold;
      const color = i === 0 ? "#4ef4ff" : "#ffd166";
      const cx = x + 16 + i * (cardW + gap);
      g.save();
      g.globalAlpha = owned ? 1 : 0.35;
      g.fillStyle = owned ? color + "22" : "rgba(6,14,22,0.6)";
      g.strokeStyle = owned ? color : "rgba(130,170,190,0.5)";
      g.lineWidth = 1;
      VB.roundRect(g, cx, cy, cardW, 20, 3);
      g.fill();
      g.stroke();
      g.fillStyle = owned ? color : "#718b9c";
      g.fillRect(cx + 5, cy + 5, 10, 7);
      text(g, i === 0 ? "CYAN" : "GOLD", cx + 20, cy + 11.5, 7.5, owned ? color : "#718b9c", "left", 1);
      if (!owned) {
        g.strokeStyle = "rgba(130,170,190,0.4)";
        g.beginPath();
        g.arc(cx + cardW - 9, cy + 10, 3, 0, TAU);
        g.stroke();
      }
      g.restore();
    }

    text(g, `LOGS ${game.logsRead}/5`, x + w - 16, y + 56, 8, "#5dffb0", "right", 1.5);
    text(g, `KILLS ${game.kills}`, x + w - 16, y + 70, 8, "#7593a8", "right", 1.5);
  }

  function drawMinimap(g, game) {
    const W = game.width;
    const world = game.world;
    if (W < 620) return;
    const mobile = W < 1100;
    const w = mobile ? 176 : 204;
    const x = W - w - 22;
    const y = 22;
    const headerH = 26;
    const pad = 12;
    const mapW = w - pad * 2;
    const mapH = Math.round((mapW * world.th) / world.tw);
    const footerH = 20;
    const h = headerH + mapH + footerH + 4;

    panel(g, x, y, w, h, "rgba(78,244,255,0.22)", "rgba(2,8,15,0.84)");
    text(g, "SECTOR MAP", x + pad, y + 16, 8.5, "#6791a5", "left", 2.2);
    text(g, "NOVA-9", x + w - pad, y + 16, 8.5, "#3e6074", "right", 1.4);

    const mx = x + pad;
    const my = y + headerH;
    const sc = mapW / world.tw;

    g.save();
    g.beginPath();
    g.rect(mx, my, mapW, mapH);
    g.clip();
    g.fillStyle = "rgba(1,5,10,0.9)";
    g.fillRect(mx, my, mapW, mapH);

    // faint grid
    g.strokeStyle = "rgba(60,120,150,0.06)";
    g.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      g.beginPath();
      g.moveTo(mx + (mapW / 8) * i, my);
      g.lineTo(mx + (mapW / 8) * i, my + mapH);
      g.stroke();
    }
    for (let i = 1; i < 6; i++) {
      g.beginPath();
      g.moveTo(mx, my + (mapH / 6) * i);
      g.lineTo(mx + mapW, my + (mapH / 6) * i);
      g.stroke();
    }

    for (let ty = 0; ty < world.th; ty++) {
      for (let tx = 0; tx < world.tw; tx++) {
        if (!world.isRevealed(tx, ty)) continue;
        if (world.grid[ty][tx] !== 1) continue;
        const room = world.tileRoom(tx, ty);
        g.globalAlpha = room ? 0.44 : 0.26;
        g.fillStyle = room ? room.color : "#356b89";
        g.fillRect(mx + tx * sc, my + ty * sc, sc + 0.3, sc + 0.3);
      }
    }
    g.globalAlpha = 1;

    // doors
    for (const d of world.doors) {
      const tx = Math.floor((d.x + d.w / 2) / VB.TILE);
      const ty = Math.floor((d.y + d.h / 2) / VB.TILE);
      if (!world.isRevealed(tx, ty)) continue;
      const color = d.seal
        ? "#ff4d63"
        : d.unlocked
        ? "#5dffb0"
        : d.type === "cyan"
        ? "#4ef4ff"
        : "#ffd166";
      g.fillStyle = color;
      g.fillRect(mx + tx * sc - 1, my + ty * sc - 1, sc + 2, sc + 2);
    }

    // terminals
    for (const t of world.terminals) {
      const tx = Math.floor(t.x / VB.TILE);
      const ty = Math.floor(t.y / VB.TILE);
      if (!world.isRevealed(tx, ty)) continue;
      g.fillStyle = t.read ? "#2b6650" : "#5dffb0";
      g.fillRect(mx + tx * sc - 0.5, my + ty * sc - 0.5, 3, 3);
    }

    // pickups (keys / upgrade)
    for (const p of game.pickups) {
      if (p.dead) continue;
      const tx = Math.floor(p.x / VB.TILE);
      const ty = Math.floor(p.y / VB.TILE);
      if (!world.isRevealed(tx, ty)) continue;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(mx + tx * sc, my + ty * sc, 2, 0, TAU);
      g.fill();
    }

    // airlock
    {
      const tx = Math.floor(world.airlock.x / VB.TILE);
      const ty = Math.floor(world.airlock.y / VB.TILE);
      if (world.isRevealed(tx, ty)) {
        g.fillStyle = game.bossDefeated ? "#5dffb0" : "#6a3a42";
        g.fillRect(mx + tx * sc - 2, my + ty * sc - 2, 5, 5);
      }
    }

    // enemies
    const player = game.player;
    for (const e of game.enemies) {
      if (e.dead || !e.active) continue;
      if (VB.dist(e.x, e.y, player.x, player.y) > 560) continue;
      const tx = Math.floor(e.x / VB.TILE);
      const ty = Math.floor(e.y / VB.TILE);
      if (!world.isRevealed(tx, ty)) continue;
      g.globalAlpha = 0.8;
      g.fillStyle = "#ff5b76";
      g.beginPath();
      g.arc(mx + tx * sc, my + ty * sc, 1.7, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // boss
    if (game.boss && game.boss.active && !game.boss.dead) {
      const bx = mx + (game.boss.x / world.pw) * mapW;
      const by = my + (game.boss.y / world.ph) * mapH;
      g.fillStyle = "#ff45d8";
      g.shadowColor = "#ff45d8";
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(bx, by - 4);
      g.lineTo(bx + 4, by);
      g.lineTo(bx, by + 4);
      g.lineTo(bx - 4, by);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
    }

    // objective ping
    if (game.objective && game.objective.target && !(game.boss && game.boss.active && !game.boss.dead)) {
      const tx = mx + (game.objective.target.x / world.pw) * mapW;
      const ty = my + (game.objective.target.y / world.ph) * mapH;
      const tone = game.objective.tone || "#4ef4ff";
      const puls = (game.time * 1.4) % 1;
      g.strokeStyle = tone;
      g.globalAlpha = 0.9 - puls * 0.7;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(tx, ty, 3 + puls * 9, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = tone;
      g.beginPath();
      g.arc(tx, ty, 2, 0, TAU);
      g.fill();
    }

    // player
    const px = mx + (player.x / world.pw) * mapW;
    const py = my + (player.y / world.ph) * mapH;
    g.save();
    g.translate(px, py);
    g.rotate(player.angle);
    g.fillStyle = "#eafcff";
    g.shadowColor = "#4ef4ff";
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(5, 0);
    g.lineTo(-3, -3.2);
    g.lineTo(-1.5, 0);
    g.lineTo(-3, 3.2);
    g.closePath();
    g.fill();
    g.restore();

    g.restore();

    g.strokeStyle = "rgba(78,244,255,0.2)";
    g.strokeRect(mx + 0.5, my + 0.5, mapW - 1, mapH - 1);

    const room = world.roomAt(player.x, player.y);
    text(
      g,
      room ? `${room.name} // ${room.code}` : "NOVA-9 // TRANSIT",
      x + pad,
      y + headerH + mapH + 14,
      7.5,
      "#5c8296",
      "left",
      1.6
    );
  }

  function drawObjective(g, game) {
    const W = game.width;
    const obj = game.objective;
    if (!obj) return;
    const tone = obj.tone || "#4ef4ff";

    if (W < 1100) {
      const tl = game.touchMode ? touchLayout(game) : null;
      const x = tl ? tl.slotX : 22;
      const y = tl ? tl.slotY : 142;
      const w = tl ? tl.slotW : W < 620 ? Math.min(268, W - 44) : Math.min(560, W - 242);
      const h = tl ? tl.slotH : 60;
      g.save();
      g.fillStyle = "rgba(2,8,15,0.78)";
      g.fillRect(x, y, w, h);
      g.strokeStyle = "rgba(78,244,255,0.18)";
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = tone;
      g.fillRect(x, y, 2, h);
      text(g, obj.label || "CURRENT DIRECTIVE", x + 12, y + 15, 7.5, "#5e899d", "left", 2.4);
      g.font = `600 ${tl ? 9 : 10.5}px "Consolas",monospace`;
      g.textAlign = "left";
      g.fillStyle = "#e6f9ff";
      const lines = VB.wrapText(g, obj.text, w - 26).slice(0, 2);
      lines.forEach((line, i) => g.fillText(line, x + 12, y + (tl ? 30 : 32) + i * (tl ? 12 : 14)));
      g.restore();
      return;
    }

    const cx = W / 2;
    const maxW = 560;

    g.save();
    g.textAlign = "center";
    text(g, obj.label || "CURRENT DIRECTIVE", cx, 32, 8.5, "#5e899d", "center", 3);

    let size = 14.5;
    g.font = `600 ${size}px "Consolas",monospace`;
    while (g.measureText(obj.text).width > maxW && size > 10) {
      size -= 0.5;
      g.font = `600 ${size}px "Consolas",monospace`;
    }
    g.textAlign = "center";
    setLS(g, 1.2);
    g.fillStyle = "#e6f9ff";
    g.shadowColor = "rgba(0,0,0,0.8)";
    g.shadowBlur = 8;
    g.fillText(obj.text, cx, 56);
    g.shadowBlur = 0;
    setLS(g, 0);

    const lineW = 300;
    const lg = g.createLinearGradient(cx - lineW / 2, 0, cx + lineW / 2, 0);
    lg.addColorStop(0, "rgba(78,244,255,0)");
    lg.addColorStop(0.5, tone);
    lg.addColorStop(1, "rgba(78,244,255,0)");
    g.strokeStyle = lg;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(cx - lineW / 2, 68);
    g.lineTo(cx + lineW / 2, 68);
    g.stroke();
    g.globalAlpha = 1;

    const blink = 0.5 + Math.sin(game.time * 3.2) * 0.5;
    g.fillStyle = tone;
    g.globalAlpha = 0.55 + blink * 0.45;
    g.beginPath();
    g.arc(cx, 76, 2.4, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.restore();
  }

  function drawEscapeBanner(g, game) {
    const W = game.width;
    const cx = W / 2;
    const t = Math.max(0, game.escapeTimer);
    const urgent = t <= 15;
    const pulse = 0.5 + Math.sin(game.time * (urgent ? 12 : 4)) * 0.5;

    if (W < 1100) {
      const tl = game.touchMode ? touchLayout(game) : null;
      const x = tl ? tl.slotX : 22;
      const y = tl ? tl.slotY : 142;
      const bh = tl ? tl.slotH : 64;
      const w = tl ? tl.slotW : W < 620 ? Math.min(268, W - 44) : Math.min(560, W - 242);
      g.save();
      g.fillStyle = "rgba(20,4,8,0.85)";
      g.fillRect(x, y, w, bh);
      g.strokeStyle = `rgba(255,77,99,${0.35 + pulse * 0.3})`;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, bh - 1);
      g.fillStyle = "#ff4d63";
      g.fillRect(x, y, 2, bh);
      text(g, "REACTOR CASCADE", x + 12, y + 15, 8, "#ff8b9b", "left", 2.4);
      g.font = `700 ${tl ? 21 : 28}px "Consolas",monospace`;
      g.textAlign = "left";
      g.fillStyle = urgent ? "#fff" : "#ff6b7d";
      g.shadowColor = "#ff4d63";
      g.shadowBlur = urgent ? 22 + pulse * 14 : 12;
      g.fillText(VB.formatTime(t), x + 12, y + (tl ? 38 : 45));
      g.shadowBlur = 0;
      g.font = '7.5px "Consolas",monospace';
      g.fillStyle = "#ffb7c0";
      g.textAlign = "right";
      setLS(g, 1);
      g.fillText("REACH AIRLOCK 09", x + w - 12, y + (tl ? 37 : 44));
      setLS(g, 0);
      g.restore();
      return;
    }

    g.save();
    const w = 390;
    const x = cx - w / 2;
    const y = 20;
    panel(
      g,
      x,
      y,
      w,
      94,
      `rgba(255,77,99,${0.35 + pulse * 0.3})`,
      "rgba(20,4,8,0.82)"
    );

    text(g, "REACTOR CASCADE", cx, y + 20, 9.5, "#ff8b9b", "center", 4);
    g.font = '700 42px "Consolas",monospace';
    g.textAlign = "center";
    g.fillStyle = urgent ? "#fff" : "#ff6b7d";
    g.shadowColor = "#ff4d63";
    g.shadowBlur = urgent ? 22 + pulse * 14 : 12;
    g.fillText(VB.formatTime(t), cx, y + 58);
    g.shadowBlur = 0;
    setLS(g, 1.8);
    g.font = '9px "Consolas",monospace';
    g.fillStyle = "#ffb7c0";
    g.fillText("REACH AIRLOCK 09 — DOCKING BAY", cx, y + 78);
    setLS(g, 0);
    g.restore();
  }

  function drawToasts(g, game) {
    if (!game.toasts || !game.toasts.length) return;
    const W = game.width;
    const startY = game.touchMode
      ? touchLayout(game).toastY
      : W < 1100
        ? 212
        : game.escapeActive
          ? 124
          : 92;
    const tones = {
      cyan: "#4ef4ff",
      gold: "#ffd166",
      red: "#ff4d63",
      green: "#5dffb0",
      magenta: "#ff45d8",
    };
    for (let i = 0; i < game.toasts.length; i++) {
      const toast = game.toasts[i];
      const color = tones[toast.tone] || tones.cyan;
      const fade = Math.min(1, toast.time * 3) * Math.min(1, (toast.max - toast.time) * 6 + 0.3);
      g.save();
      g.globalAlpha = Math.max(0, fade);
      let fs = 10.5;
      g.font = `600 ${fs}px "Consolas",monospace`;
      let w = g.measureText(toast.text).width + 46;
      if (w > W - 16) {
        fs = Math.max(7, fs * ((W - 16) / w));
        g.font = `600 ${fs}px "Consolas",monospace`;
        w = g.measureText(toast.text).width + 46;
      }
      const x = W / 2 - w / 2;
      const y = startY + i * 30;
      g.fillStyle = "rgba(2,8,14,0.82)";
      g.fillRect(x, y, w, 24);
      g.strokeStyle = color + "55";
      g.strokeRect(x + 0.5, y + 0.5, w - 1, 23);
      g.fillStyle = color;
      g.fillRect(x, y, 2, 24);
      g.fillStyle = color;
      g.beginPath();
      g.arc(x + 16, y + 12, 2.4, 0, TAU);
      g.fill();
      g.fillStyle = "#dff5ff";
      setLS(g, 1.2);
      g.textAlign = "left";
      g.fillText(toast.text, x + 26, y + 16);
      setLS(g, 0);
      g.restore();
    }
  }

  function drawKillBanner(g, game) {
    const b = game.banner;
    if (!b) return;
    const W = game.width;
    const H = game.height;
    const y = VB.clamp(H * 0.3, 132, Math.max(132, H - 280));
    const settle = Math.max(0, 1 - (1 - b.time / b.max) * 5.5);
    const pop = 1 + 0.28 * settle * settle;
    const alpha =
      Math.min(1, (1 - b.time / b.max) * 12 + 0.2) * Math.min(1, b.time * 2.6);

    const size = VB.clamp(Math.min(W * 0.062, 30), 15, 30);
    g.save();
    g.globalAlpha = Math.max(0, alpha);
    g.translate(W / 2, y - settle * 6);
    g.scale(pop, pop);
    g.textAlign = "center";
    g.textBaseline = "middle";

    setLS(g, 3.5);
    g.font = `900 ${size}px "Consolas","Courier New",monospace`;
    const tw = g.measureText(b.text).width;
    setLS(g, 0);
    const pw = Math.min(W - 20, tw + 84);
    const ph = size + 20;

    g.beginPath();
    g.moveTo(-pw / 2 + 15, -ph / 2);
    g.lineTo(pw / 2, -ph / 2);
    g.lineTo(pw / 2 - 15, ph / 2);
    g.lineTo(-pw / 2, ph / 2);
    g.closePath();
    g.fillStyle = "rgba(2,7,13,0.74)";
    g.fill();
    g.strokeStyle = b.color;
    g.lineWidth = 1.4;
    g.globalAlpha = Math.max(0, alpha * 0.7);
    g.stroke();
    g.globalAlpha = Math.max(0, alpha);

    g.fillStyle = b.color;
    g.fillRect(-pw / 2 + 4, -ph / 2 + 3, 3, ph - 6);
    g.fillRect(pw / 2 - 7, -ph / 2 + 3, 3, ph - 6);

    g.lineWidth = 3.5;
    g.strokeStyle = "rgba(1,5,10,0.9)";
    g.strokeText(b.text, 0, 1);
    setLS(g, 3.5);
    g.shadowColor = b.color;
    g.shadowBlur = 14;
    g.fillStyle = b.color;
    g.fillText(b.text, 0, 1);
    g.shadowBlur = 0;
    g.globalAlpha = Math.max(0, alpha * 0.5);
    g.fillStyle = "#f4feff";
    g.fillText(b.text, 0, 0);
    g.globalAlpha = Math.max(0, alpha * 0.8);
    if (b.tier) {
      text(g, "STREAK x" + Math.max(1, b.tier), 0, ph / 2 + 12, 8.5, b.color, "center", 2.4);
    }
    g.restore();
  }

  function speakerColor(speaker) {
    if (speaker === "AURORA") return "#ff66dc";
    if (speaker === "KESTREL") return "#ffd166";
    const chars = VB.CHARACTERS;
    for (const id in chars) {
      if (chars[id].name === speaker) return chars[id].accent;
    }
    return "#9fc4d8";
  }

  function drawDialog(g, game) {
    if (!game.dialog) return;
    const W = game.width;
    const H = game.height;
    const tl = game.touchMode ? touchLayout(game) : null;
    const d = game.dialog;
    const w = Math.min(680, W - 48);
    const x = (W - w) / 2;
    const y = tl ? tl.dialogY : H - 184;
    const bh = tl ? tl.dialogH : 64;
    const alpha =
      Math.min(1, (d.max - d.time) * 8 + 0.2) * Math.min(1, d.time * 2.2);
    const color = speakerColor(d.speaker);

    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, alpha));
    g.fillStyle = "rgba(2,7,13,0.88)";
    g.fillRect(x, y, w, bh);
    g.strokeStyle = "rgba(110,170,200,0.2)";
    g.strokeRect(x + 0.5, y + 0.5, w - 1, bh - 1);
    g.fillStyle = color;
    g.fillRect(x, y, 2.5, bh);

    g.font = '700 9px "Consolas",monospace';
    g.fillStyle = color;
    setLS(g, 2.4);
    g.textAlign = "left";
    g.fillText(d.speaker || "SYSTEM", x + 20, y + 19);
    setLS(g, 0);

    g.font = `400 ${tl ? 11.5 : 12.5}px "Consolas",monospace`;
    g.fillStyle = "#d6edf8";
    const words = VB.wrapText(g, d.text, w - 44);
    const lines = words.slice(0, tl ? 2 : 2);
    lines.forEach((line, i) => g.fillText(line, x + 20, y + (tl ? 32 : 38) + i * (tl ? 14 : 17)));
    g.restore();
  }

  function drawBossBar(g, game) {
    const b = game.boss;
    if (!b || !b.active || b.dead) return;
    const W = game.width;
    const H = game.height;
    const tl = game.touchMode ? touchLayout(game) : null;
    const compact = W < 1100 || H < 560;
    const w = tl
      ? tl.slotW
      : compact
        ? W < 620
          ? Math.min(268, W - 44)
          : Math.min(560, W - 242)
        : Math.min(560, W - 60);
    const x = tl ? tl.slotX : compact ? 22 : (W - w) / 2;
    const y = tl ? tl.slotY + 20 : compact ? 154 : H - 268;

    g.save();
    g.globalAlpha = b.spawnT > 0 ? 0.4 : 0.95;
    const title = w < 400 ? "AURORA // CORE AI" : "AURORA // STATION INTELLIGENCE";
    text(g, title, x, y - 9, w < 400 ? 8 : 9, "#ff8ae8", "left", w < 400 ? 1.6 : 2.2);
    text(
      g,
      `PHASE ${b.phase3 ? 3 : b.phase2 ? 2 : 1}  //  ${Math.ceil((b.hp / b.maxHp) * 100)}%`,
      x + w,
      y - 9,
      w < 400 ? 7.5 : 8,
      "#8b7f9d",
      "right",
      1.4
    );

    g.fillStyle = "rgba(2,6,12,0.9)";
    g.fillRect(x, y, w, 10);
    const frac = Math.max(0, b.hp / b.maxHp);
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "#ff2e5c");
    grad.addColorStop(0.5, "#ff45d8");
    grad.addColorStop(1, "#ff8ae8");
    g.fillStyle = grad;
    g.fillRect(x, y, w * frac, 10);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(x, y, w * frac, 2);
    g.strokeStyle = "rgba(255,69,216,0.4)";
    g.strokeRect(x + 0.5, y + 0.5, w - 1, 9);

    for (let i = 1; i < 20; i++) {
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(x + (w / 20) * i, y, 1, 10);
    }

    // phase marks
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(x + w * 0.33, y - 3, 1, 16);
    g.fillRect(x + w * 0.66, y - 3, 1, 16);
    g.restore();
  }

  function drawPrompt(g, game) {
    if (!game.prompt) return;
    const W = game.width;
    const H = game.height;
    const p = game.prompt;
    g.save();
    g.font = '600 11px "Consolas",monospace';
    const textW = g.measureText(p.text).width;
    const showKey = p.key !== false;
    const w = textW + (showKey ? 72 : 32);
    const x = W / 2 - w / 2;
    const y = H - 230;
    g.fillStyle = "rgba(2,9,15,0.88)";
    g.fillRect(x, y, w, 30);
    g.strokeStyle = p.locked ? "rgba(255,77,99,0.55)" : "rgba(78,244,255,0.4)";
    g.strokeRect(x + 0.5, y + 0.5, w - 1, 29);

    if (showKey) {
      g.fillStyle = p.locked ? "#ff4d63" : "#4ef4ff";
      g.fillRect(x + 8, y + 7, 18, 16);
      g.fillStyle = "#04121a";
      g.font = '700 10px "Consolas",monospace';
      g.textAlign = "center";
      g.fillText("E", x + 17, y + 18.5);
    }
    g.font = '600 11px "Consolas",monospace';
    g.fillStyle = p.locked ? "#ffb7c0" : "#e2f8ff";
    g.textAlign = "left";
    setLS(g, 1);
    g.fillText(p.text, x + (showKey ? 34 : 16), y + 19.5);
    setLS(g, 0);
    g.restore();
  }

  function drawWaypoint(g, game) {
    if (!game.player || !game.objective || !game.objective.target) return;
    if (game.boss && game.boss.active && !game.boss.dead) return;
    const W = game.width;
    const H = game.height;
    const t = game.objective.target;
    const cam = game.camera;
    const sx = t.x - cam.x;
    const sy = t.y - cam.y;
    const margin = 76;
    const onScreen = sx > margin && sx < W - margin && sy > margin + 40 && sy < H - margin;
    const color = game.objective.tone || "#4ef4ff";
    const dist = Math.round(VB.dist(game.player.x, game.player.y, t.x, t.y) / 4);
    const pulse = 0.6 + Math.sin(game.time * 3.4) * 0.4;

    g.save();
    g.globalAlpha = 0.85;

    if (onScreen) {
      g.save();
      g.translate(sx, sy);
      g.rotate(Math.PI / 4);
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.globalAlpha = 0.3 + pulse * 0.3;
      g.strokeRect(-9, -9, 18, 18);
      g.globalAlpha = 0.9;
      g.strokeRect(-5, -5, 10, 10);
      g.restore();

      g.font = '600 9px "Consolas",monospace';
      g.textAlign = "center";
      g.fillStyle = color;
      setLS(g, 1.4);
      g.fillText(`${dist}m`, sx, sy + 30);
      setLS(g, 0);
    } else {
      const cx = VB.clamp(sx, margin, W - margin);
      const cy = VB.clamp(sy, margin + 50, H - margin);
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = color;
      g.globalAlpha = 0.25 + pulse * 0.3;
      g.beginPath();
      g.arc(0, 0, 20, 0, TAU);
      g.fill();
      g.globalAlpha = 0.9;
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(-6, -6);
      g.lineTo(-2, 0);
      g.lineTo(-6, 6);
      g.closePath();
      g.fill();
      g.restore();

      g.font = '600 9px "Consolas",monospace';
      g.textAlign = "center";
      g.fillStyle = color;
      setLS(g, 1.2);
      g.fillText(`${dist}m`, cx, cy + 32);
      setLS(g, 0);
    }
    g.restore();
  }

  function drawCrosshair(g, game) {
    if (game.state !== "playing") return;
    const m = game.input.mouse;
    const player = game.player;
    let hot = false;

    if (player) {
      const wx = m.x + game.camera.x;
      const wy = m.y + game.camera.y;
      for (const e of game.enemies) {
        if (e.dead || !e.active) continue;
        if (VB.dist(wx, wy, e.x, e.y) < e.r + 26) {
          hot = true;
          break;
        }
      }
      if (
        !hot &&
        game.boss &&
        game.boss.active &&
        !game.boss.dead &&
        VB.dist(wx, wy, game.boss.x, game.boss.y) < game.boss.r + 20
      ) {
        hot = true;
      }
    }

    const color = hot ? "#ff5b76" : "#9dfaff";
    const t = game.time * 1.4;
    g.save();
    g.translate(m.x, m.y);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.globalAlpha = 0.9;
    g.lineWidth = 1.2;

    g.beginPath();
    g.arc(0, 0, hot ? 8 : 9, 0, TAU);
    g.stroke();

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
      g.lineTo(Math.cos(a) * (hot ? 19 : 17), Math.sin(a) * (hot ? 19 : 17));
      g.stroke();
    }

    g.beginPath();
    g.arc(0, 0, 1.4, 0, TAU);
    g.fill();

    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(0, 0, 20 + Math.sin(t) * 1.5, 0, TAU);
    g.stroke();
    g.restore();
  }

  /* Ability chips: a ring that fills as a cooldown recharges or an ultimate
     charges, with the archetype glyph inside so a new kit reads instantly. */
  function abilityGlyph(g, cx, cy, type, color, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = 1.3;
    g.beginPath();
    if (type === "nova") {
      g.arc(cx, cy, 4.2, 0, VB.TAU);
      for (let i = 0; i < 4; i++) {
        const a = (i * VB.TAU) / 4 + Math.PI / 4;
        g.moveTo(cx + Math.cos(a) * 5.4, cy + Math.sin(a) * 5.4);
        g.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
      }
    } else if (type === "surge") {
      g.moveTo(cx - 4, cy - 5);
      g.lineTo(cx + 1.5, cy);
      g.lineTo(cx - 4, cy + 5);
      g.moveTo(cx + 1.5, cy - 5);
      g.lineTo(cx + 6.5, cy);
      g.lineTo(cx + 1.5, cy + 5);
    } else if (type === "bulwark") {
      g.moveTo(cx, cy - 6);
      g.lineTo(cx + 5, cy - 3);
      g.lineTo(cx + 5, cy + 2);
      g.lineTo(cx, cy + 6.5);
      g.lineTo(cx - 5, cy + 2);
      g.lineTo(cx - 5, cy - 3);
      g.closePath();
    } else if (type === "phase") {
      g.moveTo(cx - 6, cy + 4);
      g.lineTo(cx + 4, cy - 4);
      g.lineTo(cx + 6.5, cy - 6.5);
      g.moveTo(cx + 1, cy - 6.5);
      g.lineTo(cx + 6.5, cy - 6.5);
      g.lineTo(cx + 6.5, cy - 1);
    } else if (type === "beam") {
      g.moveTo(cx - 7, cy + 5);
      g.lineTo(cx + 7, cy - 5);
      g.moveTo(cx - 7, cy + 1.5);
      g.lineTo(cx + 7, cy - 1.5);
    } else {
      g.arc(cx, cy, 6.2, 0, VB.TAU);
      g.moveTo(cx + 3.2, cy);
      g.arc(cx, cy, 3.2, 0, VB.TAU);
    }
    g.stroke();
    g.restore();
  }

  function abilityChip(g, x, y, size, frac, def, label, color, pulse) {
    const ready = frac >= 1;
    g.save();
    g.fillStyle = "rgba(3,10,18,0.82)";
    VB.roundRect(g, x, y, size, size, 5);
    g.fill();
    g.strokeStyle = ready ? color : "rgba(120,160,180,0.3)";
    g.lineWidth = ready ? 1.5 : 1;
    if (ready) {
      g.shadowColor = color;
      g.shadowBlur = 8 + pulse * 7;
    }
    VB.roundRect(g, x, y, size, size, 5);
    g.stroke();
    g.shadowBlur = 0;

    // recharge sweep
    const cx = x + size / 2;
    const cy = y + size / 2;
    const rad = size / 2 + 4.5;
    g.lineWidth = 2.4;
    g.strokeStyle = "rgba(80,120,140,0.22)";
    g.beginPath();
    g.arc(cx, cy, rad, 0, VB.TAU);
    g.stroke();
    g.strokeStyle = ready ? color : "rgba(120,180,200,0.55)";
    g.beginPath();
    g.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + VB.TAU * VB.clamp(frac, 0, 1));
    g.stroke();

    // cooldown shade over the glyph
    if (!ready) {
      g.globalAlpha = 0.5;
      g.fillStyle = "rgba(2,6,12,0.72)";
      VB.roundRect(g, x, y + size * (1 - frac), size, size * frac, 5);
      g.fill();
      g.globalAlpha = 1;
    }

    abilityGlyph(g, cx, cy, def.type, ready ? color : "#6f8b9c", ready ? 1 : 0.72);

    text(g, label, x + size / 2, y - 6, 8, ready ? color : "#5f7b8c", "center", 1.4);
    text(g, def.name, cx, y + size + 12, 7, ready ? "#cfeaf6" : "#5f7b8c", "center", 1);
    g.restore();
  }

  function drawAbilityMeters(g, game) {
    const p = game.player;
    if (!p.skill || !p.skill.name) return;
    const touch = !!game.touchMode;
    const W = game.width;
    const H = game.height;
    const size = touch ? 34 : 40;
    const x = 22;
    /* On a narrow desktop window the directive plate already owns the strip
       under the player panel, so the chips drop below it instead. */
    const y = touch ? 162 : W >= 1100 ? 146 : 212;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 7);

    if (!touch) {
      abilityChip(
        g,
        x,
        y,
        size,
        1 - Math.min(1, p.skillCd / Math.max(0.001, p.skillCdMax)),
        p.skill,
        "Q",
        p.accent,
        pulse
      );
      abilityChip(
        g,
        x + size + 30,
        y,
        size,
        p.ultCharge / p.ultMax,
        p.ultDef,
        "R",
        p.ultCharge >= p.ultMax ? "#ffd166" : p.accent,
        pulse
      );
    }

    if (game.linkN >= 2) {
      const lw = touch ? 152 : 208;
      /* On a phone the whole upper band is already spoken for, so the chain
         readout lives in the gap between the two thumb sticks. */
      const lx = touch ? VB.clamp(W / 2 - lw / 2, 8, W - lw - 8) : W >= 1100 ? x : x + 2 * (size + 30) + 6;
      const ly = touch ? H - 50 : W >= 1100 ? y + size + 26 : y + 5;
      g.save();
      g.globalAlpha = 0.94;
      g.fillStyle = "rgba(2,7,13,0.78)";
      VB.roundRect(g, lx, ly, lw, 30, 4);
      g.fill();
      g.strokeStyle = "#4ef4ff";
      g.lineWidth = 1.2;
      VB.roundRect(g, lx, ly, lw, 30, 4);
      g.stroke();
      text(g, `SQUAD LINK x${game.linkN}`, lx + 10, ly + 13, 9, "#4ef4ff", "left", 2);
      text(g, p.fusion, lx + 10, ly + 25, 7, "#9fc4d8", "left", 1);
      const frac = Math.max(0, game.linkTimer / 7);
      g.fillStyle = "rgba(78,244,255,0.18)";
      g.fillRect(lx + lw - 62, ly + 9, 52, 4);
      g.fillStyle = "#4ef4ff";
      g.fillRect(lx + lw - 62, ly + 9, 52 * frac, 4);
      g.restore();
    }
  }

  function drawHUD(g, game) {
    if (!game.player) return;
    drawPlayerPanel(g, game);
    drawWeaponPanel(g, game);
    drawMinimap(g, game);
    drawAbilityMeters(g, game);

    if (game.escapeActive) drawEscapeBanner(g, game);
    else if (game.width >= 1100 || !game.boss || !game.boss.active || game.boss.dead) {
      drawObjective(g, game);
    }

    drawToasts(g, game);
    drawKillBanner(g, game);
    drawBossBar(g, game);
    if (!game.touchMode) drawPrompt(g, game);
    drawDialog(g, game);

    const W = game.width;
    const H = game.height;
    if (!game.touchMode) {
      g.save();
      g.globalAlpha = 0.5;
      text(g, "ESC PAUSE   ·   M AUDIO", W - 26, H - 20, 7.5, "#547084", "right", 1.6);
      g.restore();
    }
  }

  VB.drawHUD = drawHUD;
  VB.abilityGlyph = abilityGlyph;
  VB.drawCrosshair = drawCrosshair;
  VB.drawWaypoint = drawWaypoint;
  VB.stage && VB.stage("hud");
})();
