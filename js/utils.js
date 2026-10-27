(function () {
  "use strict";
  const VB = (window.VB = window.VB || {});

  VB.TAU = Math.PI * 2;
  VB.TILE = 48;
  VB.VERSION = "1.3.0";

  VB.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  VB.lerp = (a, b, t) => a + (b - a) * t;
  VB.damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  VB.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  VB.dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
  };
  VB.rand = (a, b) => a + Math.random() * (b - a);
  VB.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  VB.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  VB.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  VB.normAngle = (a) => {
    a = (a + Math.PI) % VB.TAU;
    if (a < 0) a += VB.TAU;
    return a - Math.PI;
  };

  VB.hash2 = (x, y, s) => {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  VB.circleRect = (cx, cy, r, rx, ry, rw, rh) => {
    const nx = VB.clamp(cx, rx, rx + rw);
    const ny = VB.clamp(cy, ry, ry + rh);
    return VB.dist2(cx, cy, nx, ny) <= r * r;
  };

  VB.roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  VB.formatTime = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  VB.pointInRect = (x, y, r) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  VB.wrapText = (ctx, text, maxWidth) => {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
})();
