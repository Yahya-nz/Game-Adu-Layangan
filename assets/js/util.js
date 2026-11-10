'use strict';
// ================= Utilitas umum =================

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Mendekati target secara eksponensial, tidak tergantung frame rate.
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ---- Warna ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function rgba(c, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}
// Interpolasi warna dari daftar keyframe [[t, rgb], ...]
function rampRgb(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return mixRgb(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}

// ---- Geometri ----
function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: ax + rx * t, y: ay + ry * t };
}

// Titik potong dua polyline (array datar [x0,y0,x1,y1,...]).
// ta/tb = posisi relatif sepanjang masing-masing tali (0 = jangkar, 1 = layangan).
function polyIntersect(a, b) {
  const na = a.length / 2 - 1, nb = b.length / 2 - 1;
  for (let i = 0; i < na; i++) {
    const ax = a[i * 2], ay = a[i * 2 + 1], bx = a[i * 2 + 2], by = a[i * 2 + 3];
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by), maxY = Math.max(ay, by);
    for (let j = 0; j < nb; j++) {
      const cx = b[j * 2], cy = b[j * 2 + 1], dx = b[j * 2 + 2], dy = b[j * 2 + 3];
      if (Math.max(cx, dx) < minX || Math.min(cx, dx) > maxX) continue;
      if (Math.max(cy, dy) < minY || Math.min(cy, dy) > maxY) continue;
      const r = segIntersect(ax, ay, bx, by, cx, cy, dx, dy);
      if (r) return { x: r.x, y: r.y, ta: (i + r.t) / na, tb: (j + r.u) / nb, ia: i, ib: j };
    }
  }
  return null;
}

// Bentuk tali layangan: garis dari jangkar ke layangan yang melengkung
// ke bawah (gravitasi) dan ke arah angin.
const STR_N = 16;
function buildString(out, ax, ay, kx, ky, sagK, bowK) {
  const dx = kx - ax, dy = ky - ay;
  const len = Math.hypot(dx, dy);
  const sag = len * sagK, bow = len * bowK;
  for (let i = 0; i <= STR_N; i++) {
    const t = i / STR_N, f = 4 * t * (1 - t);
    out[i * 2] = ax + dx * t + bow * f;
    out[i * 2 + 1] = ay + dy * t + sag * f;
  }
  return out;
}

// Ambil sebagian polyline (dari indeks titik potong) lalu sampling ulang
// menjadi n titik berjarak sama. from: 'start' = jangkar..potong, 'end' = potong..layangan
function slicePolyline(pts, cut, part, maxLen, n) {
  const raw = [];
  const N = pts.length / 2 - 1;
  if (part === 'start') {
    for (let i = 0; i <= cut.ib; i++) raw.push([pts[i * 2], pts[i * 2 + 1]]);
    raw.push([cut.x, cut.y]);
  } else {
    // dari layangan ke titik potong (supaya indeks 0 = layangan)
    for (let i = N; i > cut.ib; i--) raw.push([pts[i * 2], pts[i * 2 + 1]]);
    raw.push([cut.x, cut.y]);
  }
  // potong panjang maksimum
  const lens = [0];
  for (let i = 1; i < raw.length; i++) {
    lens.push(lens[i - 1] + dist(raw[i - 1][0], raw[i - 1][1], raw[i][0], raw[i][1]));
  }
  const total = Math.min(lens[lens.length - 1], maxLen);
  const out = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (seg < raw.length - 1 && lens[seg] < d) seg++;
    const l0 = lens[seg - 1], l1 = lens[seg];
    const t = l1 > l0 ? clamp((d - l0) / (l1 - l0), 0, 1) : 0;
    out.push({
      x: lerp(raw[seg - 1][0], raw[seg][0], t),
      y: lerp(raw[seg - 1][1], raw[seg][1], t),
    });
  }
  return { points: out, length: total };
}

// ---- Tali fisika (Verlet) untuk ekor layangan & benang putus ----
class Rope {
  constructor(points, segLen) {
    this.n = points.length;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.ox = new Float32Array(this.n);
    this.oy = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.x[i] = this.ox[i] = points[i].x;
      this.y[i] = this.oy[i] = points[i].y;
    }
    this.seg = segLen;
  }
  static hanging(x, y, n, segLen) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x, y: y + i * segLen });
    return new Rope(pts, segLen);
  }
  // pin: {x,y} untuk titik 0 (atau null), damping 0..1, fx/fy = gaya (unit/s^2)
  update(dt, pin, fx, fy, damping = 0.97, iters = 4) {
    const dt2 = dt * dt;
    for (let i = 0; i < this.n; i++) {
      const vx = (this.x[i] - this.ox[i]) * damping;
      const vy = (this.y[i] - this.oy[i]) * damping;
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      this.x[i] += vx + fx * dt2;
      this.y[i] += vy + fy * dt2;
    }
    for (let k = 0; k < iters; k++) {
      if (pin) { this.x[0] = pin.x; this.y[0] = pin.y; }
      for (let i = 0; i < this.n - 1; i++) {
        const dx = this.x[i + 1] - this.x[i], dy = this.y[i + 1] - this.y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - this.seg) / d;
        if (i === 0 && pin) {
          this.x[i + 1] -= dx * diff;
          this.y[i + 1] -= dy * diff;
        } else {
          this.x[i] += dx * diff * 0.5;
          this.y[i] += dy * diff * 0.5;
          this.x[i + 1] -= dx * diff * 0.5;
          this.y[i + 1] -= dy * diff * 0.5;
        }
      }
    }
    if (pin) { this.x[0] = pin.x; this.y[0] = pin.y; }
  }
  translate(dx, dy) {
    for (let i = 0; i < this.n; i++) {
      this.x[i] += dx; this.y[i] += dy; this.ox[i] += dx; this.oy[i] += dy;
    }
  }
  path(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.x[0], this.y[0]);
    for (let i = 1; i < this.n; i++) ctx.lineTo(this.x[i], this.y[i]);
  }
}

// ---- Penyimpanan lokal yang aman ----
const Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('aduLayangan.' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('aduLayangan.' + key, JSON.stringify(val)); } catch (e) { /* abaikan */ }
  },
};
