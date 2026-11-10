'use strict';
// ================= Latar: langit, awan, bukit, rumah kampung, orang =================

const SKY_TOP = [[0, [86, 155, 224]], [0.5, [64, 46, 118]], [1, [10, 14, 40]]];
const SKY_MID = [[0, [150, 200, 236]], [0.5, [226, 112, 138]], [1, [30, 38, 88]]];
const SKY_BOT = [[0, [252, 226, 180]], [0.5, [255, 186, 118]], [1, [66, 60, 116]]];
const HILL_FAR = [[0, [132, 166, 204]], [0.5, [156, 98, 140]], [1, [36, 40, 82]]];
const HILL_NEAR = [[0, [98, 140, 132]], [0.5, [116, 68, 100]], [1, [24, 28, 60]]];
const BACK_HOUSE = [[0, [104, 116, 138]], [0.5, [92, 52, 84]], [1, [18, 20, 46]]];
const TREE_COL = [[0, [48, 88, 70]], [0.5, [60, 34, 62]], [1, [12, 14, 34]]];
const STREET_COL = [[0, [128, 112, 98]], [0.5, [96, 64, 74]], [1, [28, 28, 48]]];
const CLOUD_COL = [[0, [255, 255, 255]], [0.5, [255, 198, 188]], [1, [72, 76, 126]]];
const SHADE = [[0, [255, 255, 255]], [0.5, [226, 170, 172]], [1, [72, 72, 124]]];

const WALL_COLORS = ['#f2e2c4', '#cfe3d6', '#f5c9a8', '#d9d2ef', '#f7e19c', '#bfdcea', '#efc6cf'];
const ROOF_COLORS = ['#b5532f', '#9c4426', '#c0643a', '#8a3b2a', '#a8582f'];
const SKINS = ['#8d5524', '#a0662f', '#c68642', '#7a4a22'];

const mulRgb = (c, m) => [(c[0] * m[0]) / 255, (c[1] * m[1]) / 255, (c[2] * m[2]) / 255];

const Scene = {
  W: 0, H: 0,
  tod: 0, todTarget: 0,
  houses: [], backHouses: [], trees: [], clouds: [], stars: [], streaks: [], birds: [],
  hillFar: [], hillNear: [],
  birdTimer: 6,
  col: {},

  build(W, H) {
    this.W = W; this.H = H;
    this.baseY = H - 44;
    this.streetY = H - 22;

    // rumah depan
    this.houses = [];
    let x = -rand(10, 50);
    while (x < W + 40) {
      const w = rand(104, 168);
      const h = {
        x, w,
        wallH: rand(50, 80),
        roofH: rand(30, 46),
        type: Math.random() < 0.55 ? 'pelana' : 'limas',
        wall: hexToRgb(pick(WALL_COLORS)),
        roof: hexToRgb(pick(ROOF_COLORS)),
        win: Math.random() < 0.8,
        door: Math.random() < 0.6,
      };
      h.cx = x + w / 2;
      h.ridgeY = this.baseY - h.wallH - h.roofH;
      this.houses.push(h);
      x += w + rand(4, 18);
    }
    // rumah pemain: yang paling dekat ke 22% lebar layar
    let best = null;
    for (const h of this.houses) {
      if (!best || Math.abs(h.cx - W * 0.22) < Math.abs(best.cx - W * 0.22)) best = h;
    }
    best.player = true;
    best.wall = hexToRgb('#fff1d6');
    best.roof = hexToRgb('#c0392b');
    this.playerHouse = best;

    // deretan rumah belakang (siluet)
    this.backHouses = [];
    x = -30;
    while (x < W + 30) {
      const w = rand(60, 120);
      this.backHouses.push({ x, w, h: rand(40, 80), roof: rand(16, 30), type: Math.random() < 0.5 });
      x += w + rand(-6, 10);
    }

    // pohon kelapa
    this.trees = [];
    const nTrees = Math.max(2, Math.round(W / 320));
    for (let i = 0; i < nTrees; i++) {
      this.trees.push({
        x: (W * (i + 0.5)) / nTrees + rand(-60, 60),
        h: rand(150, 220),
        lean: rand(-0.25, 0.25),
        ph: rand(0, TAU),
      });
    }

    // bukit
    const hill = (amp, base, f1, f2) => {
      const pts = [];
      const p1 = rand(0, TAU), p2 = rand(0, TAU);
      for (let xx = -20; xx <= W + 20; xx += 20) {
        pts.push([xx, base - amp * (0.6 + 0.4 * Math.sin(xx * f1 + p1)) - amp * 0.35 * Math.sin(xx * f2 + p2)]);
      }
      return pts;
    };
    this.hillFar = hill(90, this.baseY - 70, 0.004, 0.011);
    this.hillNear = hill(55, this.baseY - 40, 0.006, 0.017);

    // awan
    this.clouds = [];
    const nClouds = Math.round(W / 190) + 2;
    for (let i = 0; i < nClouds; i++) this.clouds.push(this.makeCloud(rand(-100, W + 100)));

    // bintang
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({ x: rand(0, W), y: rand(0, H * 0.62), r: rand(0.6, 1.7), ph: rand(0, TAU) });
    }

    // garis angin
    this.streaks = [];
    for (let i = 0; i < 16; i++) this.streaks.push(this.makeStreak(true));
    this.birds = [];
    this.updateColors();
  },

  makeCloud(x) {
    const s = rand(0.6, 1.3);
    const puffs = [];
    const n = randi(4, 6);
    for (let i = 0; i < n; i++) {
      puffs.push({ dx: (i - n / 2) * 26 * s + rand(-8, 8), dy: rand(-14, 6) * s, r: rand(20, 34) * s });
    }
    return { x, y: rand(110, this.H * 0.5), puffs, speed: rand(0.5, 1.1), w: n * 26 * s };
  },

  makeStreak(anywhere) {
    return {
      x: anywhere ? rand(0, this.W) : -80,
      y: rand(30, this.baseY - 160),
      len: rand(40, 120),
      sp: rand(0.8, 1.4),
      a: rand(0.25, 1),
    };
  },

  update(dt, wind, t) {
    this.tod = approach(this.tod, this.todTarget, 0.5, dt);
    this.updateColors();
    this.updateMotion(dt, wind, t);
  },

  updateColors() {
    const tod = this.tod;
    const c = this.col;
    c.skyTop = rampRgb(SKY_TOP, tod);
    c.skyMid = rampRgb(SKY_MID, tod);
    c.skyBot = rampRgb(SKY_BOT, tod);
    c.hillFar = rampRgb(HILL_FAR, tod);
    c.hillNear = rampRgb(HILL_NEAR, tod);
    c.back = rampRgb(BACK_HOUSE, tod);
    c.tree = rampRgb(TREE_COL, tod);
    c.street = rampRgb(STREET_COL, tod);
    c.cloud = rampRgb(CLOUD_COL, tod);
    c.shade = rampRgb(SHADE, tod);
    c.night = smoothstep(0.55, 0.95, tod);
  },

  updateMotion(dt, wind, t) {
    const W = this.W;
    for (const cl of this.clouds) {
      cl.x += (wind.x * 30 + 5) * cl.speed * dt;
      if (cl.x - cl.w > W + 60) Object.assign(cl, this.makeCloud(-cl.w - 60));
      else if (cl.x + cl.w < -80) Object.assign(cl, this.makeCloud(W + cl.w + 40));
    }
    for (const s of this.streaks) {
      s.x += wind.x * 340 * s.sp * dt;
      if (wind.x >= 0 && s.x > W + 20) Object.assign(s, this.makeStreak(false), { x: -s.len });
      if (wind.x < 0 && s.x + s.len < -20) Object.assign(s, this.makeStreak(false), { x: W + 20 });
    }

    // burung lewat sesekali
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = rand(14, 26);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = rand(60, this.H * 0.35);
      const n = randi(3, 6);
      for (let i = 0; i < n; i++) {
        this.birds.push({
          x: dir > 0 ? -30 - i * 22 : W + 30 + i * 22,
          y: y + (i % 2 ? 1 : -1) * i * 8,
          vx: dir * rand(70, 90), ph: rand(0, TAU), s: rand(0.8, 1.1),
        });
      }
    }
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.ph += dt * 9;
      b.y += Math.sin(t * 2 + b.ph * 0.1) * 6 * dt;
    }
    this.birds = this.birds.filter((b) => b.x > -80 && b.x < W + 80);
  },

  // ---------- Gambar ----------
  drawSky(ctx, t, wind) {
    const { W, H } = this;
    const c = this.col;
    const g = ctx.createLinearGradient(0, 0, 0, this.baseY);
    g.addColorStop(0, rgba(c.skyTop));
    g.addColorStop(0.55, rgba(c.skyMid));
    g.addColorStop(1, rgba(c.skyBot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // bintang
    if (c.night > 0.01) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        ctx.globalAlpha = c.night * (0.55 + 0.45 * Math.sin(t * 2 + s.ph));
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      // bulan
      const mx = W * 0.16, my = this.H * 0.15;
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
      mg.addColorStop(0, rgba([255, 246, 210], 0.35 * c.night));
      mg.addColorStop(1, rgba([255, 246, 210], 0));
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 90, my - 90, 180, 180);
      ctx.fillStyle = rgba([250, 244, 222], c.night);
      ctx.beginPath(); ctx.arc(mx, my, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba([220, 212, 190], c.night * 0.6);
      ctx.beginPath(); ctx.arc(mx - 7, my - 5, 5, 0, TAU); ctx.arc(mx + 6, my + 7, 3.5, 0, TAU); ctx.fill();
    }

    // matahari terbenam perlahan sesuai ronde
    const tod = this.tod;
    const sunY = lerp(this.H * 0.18, this.baseY + 20, smoothstep(0, 0.8, tod));
    const sunX = W * 0.74;
    const sunC = mixRgb([255, 244, 190], [255, 128, 84], clamp(tod * 1.6, 0, 1));
    const fade = 1 - smoothstep(0.7, 0.85, tod);
    if (fade > 0) {
      const sg = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 220);
      sg.addColorStop(0, rgba(sunC, 0.55 * fade));
      sg.addColorStop(1, rgba(sunC, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(sunX - 220, sunY - 220, 440, 440);
      ctx.fillStyle = rgba(sunC, fade);
      ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, TAU); ctx.fill();
    }

    // awan
    ctx.fillStyle = rgba(c.cloud, 0.85);
    for (const cl of this.clouds) {
      ctx.beginPath();
      for (const p of cl.puffs) {
        ctx.moveTo(cl.x + p.dx + p.r, cl.y + p.dy);
        ctx.arc(cl.x + p.dx, cl.y + p.dy, p.r, 0, TAU);
      }
      ctx.fill();
    }

    // garis angin
    const strength = Math.min(1, Math.abs(wind.x));
    if (strength > 0.05) {
      ctx.strokeStyle = rgba([255, 255, 255], 0.22 * strength);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const s of this.streaks) {
        const len = s.len * (0.4 + strength);
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.x + len / 2, s.y - 4 * s.a, s.x + len, s.y);
      }
      ctx.stroke();
    }

    // burung
    if (this.birds.length) {
      ctx.strokeStyle = rgba(mixRgb([40, 40, 60], [10, 10, 20], c.night), 0.8);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (const b of this.birds) {
        const f = Math.sin(b.ph) * 5 * b.s;
        const w = 8 * b.s;
        ctx.moveTo(b.x - w, b.y - f);
        ctx.quadraticCurveTo(b.x - w * 0.4, b.y - 2, b.x, b.y);
        ctx.quadraticCurveTo(b.x + w * 0.4, b.y - 2, b.x + w, b.y - f);
      }
      ctx.stroke();
    }
  },

  drawLand(ctx, t, wind) {
    const { W, H } = this;
    const c = this.col;
    const fillHill = (pts, col) => {
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.moveTo(-20, H);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(W + 20, H);
      ctx.fill();
    };
    fillHill(this.hillFar, c.hillFar);
    fillHill(this.hillNear, c.hillNear);

    // rumah belakang
    ctx.fillStyle = rgba(c.back);
    ctx.beginPath();
    for (const b of this.backHouses) {
      const top = this.baseY - 26 - b.h;
      ctx.rect(b.x, top, b.w, b.h + 30);
      ctx.moveTo(b.x - 6, top);
      if (b.type) ctx.lineTo(b.x + b.w / 2, top - b.roof);
      else { ctx.lineTo(b.x + b.w * 0.25, top - b.roof); ctx.lineTo(b.x + b.w * 0.75, top - b.roof); }
      ctx.lineTo(b.x + b.w + 6, top);
    }
    ctx.fill();
    // jendela menyala di malam hari
    if (c.night > 0.05) {
      ctx.fillStyle = rgba([255, 206, 110], 0.7 * c.night);
      for (let i = 0; i < this.backHouses.length; i++) {
        const b = this.backHouses[i];
        if (i % 3 === 1) continue;
        ctx.fillRect(b.x + b.w * 0.3, this.baseY - 26 - b.h * 0.6, 7, 9);
      }
    }

    // pohon kelapa
    for (const tr of this.trees) this.drawPalm(ctx, tr, t, wind, c.tree);

    // rumah depan
    for (const h of this.houses) this.drawHouse(ctx, h, c);

    // jalan
    ctx.fillStyle = rgba(c.street);
    ctx.fillRect(0, this.baseY, W, H - this.baseY);
    ctx.fillStyle = rgba(mulRgb([255, 255, 255], c.shade), 0.18);
    for (let x = 10; x < W; x += 70) ctx.fillRect(x, this.baseY + 20, 34, 3);
  },

  drawPalm(ctx, tr, t, wind, col) {
    const baseY = this.baseY;
    const topX = tr.x + tr.lean * tr.h + wind.x * 6 + Math.sin(t * 0.8 + tr.ph) * 3;
    const topY = baseY - tr.h;
    ctx.strokeStyle = rgba(col);
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(tr.x, baseY);
    ctx.quadraticCurveTo(tr.x + tr.lean * tr.h * 0.2, baseY - tr.h * 0.5, topX, topY);
    ctx.stroke();
    // pelepah
    ctx.lineWidth = 3;
    const sway = Math.sin(t * 1.3 + tr.ph) * 0.08 + wind.x * 0.12;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5 + sway;
      const len = 52 + (i % 2) * 10;
      const ex = topX + Math.cos(a) * len, ey = topY + Math.sin(a) * len * 0.55 + 22;
      const mx = topX + Math.cos(a) * len * 0.5, my = topY + Math.sin(a) * len * 0.55 - 8;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // anak daun
      ctx.beginPath();
      for (let k = 1; k <= 5; k++) {
        const q = k / 6;
        const px = lerp(lerp(topX, mx, q), lerp(mx, ex, q), q);
        const py = lerp(lerp(topY, my, q), lerp(my, ey, q), q);
        ctx.moveTo(px, py);
        ctx.lineTo(px + 4, py + 10);
      }
      ctx.stroke();
    }
    ctx.fillStyle = rgba(col);
    ctx.beginPath(); ctx.arc(topX, topY + 3, 5, 0, TAU); ctx.fill();
  },

  drawHouse(ctx, h, c) {
    const top = this.baseY - h.wallH;
    const wall = mulRgb(h.wall, c.shade);
    const roof = mulRgb(h.roof, c.shade);
    ctx.fillStyle = rgba(wall);
    ctx.fillRect(h.x, top, h.w, h.wallH + 1);
    // bayangan atap pada dinding
    ctx.fillStyle = rgba([0, 0, 0], 0.12);
    ctx.fillRect(h.x, top, h.w, 7);
    // jendela & pintu
    const lit = c.night;
    const winCol = lit > 0.05 ? mixRgb(mulRgb([70, 90, 110], c.shade), [255, 206, 110], lit) : mulRgb([70, 90, 110], c.shade);
    if (h.win) {
      ctx.fillStyle = rgba(winCol);
      const wy = top + h.wallH * 0.28;
      ctx.fillRect(h.x + h.w * 0.14, wy, 18, 16);
      ctx.fillRect(h.x + h.w * 0.86 - 18, wy, 18, 16);
      ctx.fillStyle = rgba(mulRgb([255, 255, 255], c.shade), 0.5);
      ctx.fillRect(h.x + h.w * 0.14 + 8, wy, 2, 16);
      ctx.fillRect(h.x + h.w * 0.86 - 10, wy, 2, 16);
    }
    if (h.door) {
      ctx.fillStyle = rgba(mulRgb([120, 76, 46], c.shade));
      ctx.fillRect(h.cx - 9, this.baseY - 30, 18, 30);
    }
    // atap
    ctx.fillStyle = rgba(roof);
    ctx.beginPath();
    ctx.moveTo(h.x - 8, top + 2);
    if (h.type === 'pelana') {
      ctx.lineTo(h.cx, h.ridgeY);
    } else {
      ctx.lineTo(h.x + h.w * 0.3, h.ridgeY);
      ctx.lineTo(h.x + h.w * 0.7, h.ridgeY);
    }
    ctx.lineTo(h.x + h.w + 8, top + 2);
    ctx.closePath();
    ctx.fill();
    // garis genteng
    ctx.strokeStyle = rgba([0, 0, 0], 0.16);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      const y = lerp(top + 2, h.ridgeY, k / 4);
      const inset = h.type === 'pelana' ? (h.w / 2 + 8) * (k / 4) : (h.w * 0.3 + 8) * (k / 4);
      ctx.moveTo(h.x - 8 + inset, y);
      ctx.lineTo(h.x + h.w + 8 - inset, y);
    }
    ctx.stroke();
  },

  // Orang di atas genteng. Mengembalikan posisi tangan (jangkar benang).
  personHand(x, feetY) {
    return { x: x + 9, y: feetY - 31 };
  },
  drawPerson(ctx, x, feetY, shirt, skin, opts = {}) {
    const c = this.col;
    const shade = c.shade || [255, 255, 255];
    const alpha = opts.alpha === undefined ? 1 : opts.alpha;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    const shirtC = rgba(mulRgb(hexToRgb(shirt), shade));
    const skinC = rgba(mulRgb(hexToRgb(skin), shade));
    const pants = rgba(mulRgb([46, 52, 80], shade));
    const sad = opts.mood === 'sad';
    const bob = opts.cheer ? Math.abs(Math.sin(opts.t * 10)) * 4 : 0;
    const fy = feetY - bob;
    // kaki
    ctx.strokeStyle = pants; ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, fy); ctx.lineTo(x - 1, fy - 11);
    ctx.moveTo(x + 3.5, fy); ctx.lineTo(x + 1, fy - 11);
    ctx.stroke();
    // badan
    ctx.strokeStyle = shirtC; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x, fy - 12); ctx.lineTo(x, fy - 21); ctx.stroke();
    // lengan
    ctx.strokeStyle = skinC; ctx.lineWidth = 2.6;
    ctx.beginPath();
    if (sad) {
      ctx.moveTo(x - 3, fy - 21); ctx.lineTo(x - 5, fy - 11);
      ctx.moveTo(x + 3, fy - 21); ctx.lineTo(x + 5, fy - 11);
    } else if (opts.cheer) {
      ctx.moveTo(x - 3, fy - 21); ctx.lineTo(x - 8, fy - 32);
      ctx.moveTo(x + 3, fy - 21); ctx.lineTo(x + 8, fy - 32);
    } else {
      const hand = this.personHand(x, feetY);
      ctx.moveTo(x + 3, fy - 21); ctx.lineTo(hand.x, hand.y);
      ctx.moveTo(x - 3, fy - 20); ctx.lineTo(x - 2, fy - 13);
    }
    ctx.stroke();
    // gulungan benang di tangan kiri
    if (!sad && !opts.cheer) {
      ctx.fillStyle = rgba(mulRgb([230, 220, 200], shade));
      ctx.beginPath(); ctx.arc(x - 3, fy - 12, 3, 0, TAU); ctx.fill();
    }
    // kepala
    const hx = x + (sad ? 1.5 : 0), hy = fy - 27 + (sad ? 1.5 : 0);
    ctx.fillStyle = skinC;
    ctx.beginPath(); ctx.arc(hx, hy, 4.6, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(mulRgb([30, 24, 22], shade));
    ctx.beginPath(); ctx.arc(hx, hy - 1, 4.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (opts.cap) {
      ctx.fillStyle = shirtC;
      ctx.beginPath(); ctx.arc(hx, hy - 1.5, 4.9, Math.PI, TAU); ctx.fill();
      ctx.fillRect(hx, hy - 2.5, 7, 2);
    }
    ctx.restore();
  },
};
