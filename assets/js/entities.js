'use strict';
// ================= Entitas: layangan pemain, lawan, layangan putus, anak-anak, efek =================

const SAW_REF = 450;      // kecepatan (unit/detik) yang dianggap "gesekan penuh"
const PLAYER_DMG = 130;   // kerusakan per detik ke benang lawan saat gesekan penuh
const ENEMY_DMG = 30;     // kerusakan per detik ke benangmu saat lawan menggesek penuh

const ETYPES = {
  pemula:  { label: 'Pemula',  hp: 50,  power: 0.45, vmax: 420, k: 22, size: 21, aggr: 0.5, burst: [0.9, 1.3], rest: [1.1, 1.6], amp: 30, w: 10, score: 100 },
  lincah:  { label: 'Lincah',  hp: 40,  power: 0.5,  vmax: 760, k: 46, size: 17, aggr: 0.6, burst: [0.7, 1.0], rest: [0.8, 1.2], amp: 26, w: 15, score: 200, erratic: true },
  jagoan:  { label: 'Jagoan',  hp: 80,  power: 0.7,  vmax: 520, k: 30, size: 23, aggr: 0.7, burst: [1.0, 1.5], rest: [0.8, 1.2], amp: 36, w: 12, score: 250 },
  pemburu: { label: 'Pemburu', hp: 105, power: 0.9,  vmax: 600, k: 36, size: 24, aggr: 1.0, burst: [1.2, 1.7], rest: [0.6, 0.9], amp: 40, w: 12.5, score: 400, style: HUNTER_STYLE },
  raksasa: { label: 'Raksasa', hp: 340, power: 0.8, vmax: 330, k: 16, size: 46, aggr: 1.0, burst: [1.4, 2.0], rest: [1.2, 1.6], amp: 48, w: 9, score: 2000, style: BOSS_STYLE, boss: true },
  emas:    { label: 'Emas',    hp: 55,  power: 0,    vmax: 560, k: 26, size: 21, aggr: 0,   burst: [1, 1],     rest: [1, 1],     amp: 0,  w: 0, score: 1000, style: GOLD_STYLE, golden: true },
};

// ---------------- Layangan pemain ----------------
class PlayerKite {
  constructor(game) {
    this.game = game;
    this.pts = new Array((STR_N + 1) * 2).fill(0);
    this.style = PLAYER_STYLE;
  }
  reset(anchor) {
    this.ax = anchor.x; this.ay = anchor.y;
    this.x = anchor.x + 80; this.y = anchor.y - 230;
    this.vx = 0; this.vy = -30;
    this.tx = this.x; this.ty = this.y;
    this.hp = this.maxHp = 100;
    this.size = 23;
    this.angle = 0; this.flash = 0; this.speed = 0;
    this.alive = true;
    this.moved = 0;
    this.tail = Rope.hanging(this.x, this.y + this.size, 12, 8);
    buildString(this.pts, this.ax, this.ay, this.x, this.y, 0.05, 0);
  }
  setAnchor(anchor) { this.ax = anchor.x; this.ay = anchor.y; }
  update(dt, wind, b, keys) {
    if (keys.x || keys.y) {
      this.tx += keys.x * 640 * dt;
      this.ty += keys.y * 640 * dt;
    }
    this.tx = clamp(this.tx, b.x0, b.x1);
    this.ty = clamp(this.ty, b.y0, b.y1);

    const K = 70, C = 2 * Math.sqrt(K) * 0.85;
    let ax = (this.tx - this.x) * K - this.vx * C + wind.x * 1100;
    let ay = (this.ty - this.y) * K - this.vy * C + Math.sin(this.game.t * 1.7) * 260;
    const am = Math.hypot(ax, ay), AMAX = 5200;
    if (am > AMAX) { ax *= AMAX / am; ay *= AMAX / am; }
    this.vx += ax * dt; this.vy += ay * dt;
    const vm = Math.hypot(this.vx, this.vy), VMAX = 950;
    if (vm > VMAX) { this.vx *= VMAX / vm; this.vy *= VMAX / vm; }

    const ox = this.x, oy = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < b.x0) { this.x = b.x0; this.vx = Math.max(0, this.vx); }
    if (this.x > b.x1) { this.x = b.x1; this.vx = Math.min(0, this.vx); }
    if (this.y < b.y0) { this.y = b.y0; this.vy = Math.max(0, this.vy); }
    if (this.y > b.y1) { this.y = b.y1; this.vy = Math.min(0, this.vy); }

    const sp = Math.hypot(this.x - ox, this.y - oy) / Math.max(dt, 1e-4);
    this.speed = approach(this.speed, sp, 16, dt);
    this.moved += sp * dt;
    const tilt = clamp(this.vx * 0.0011 + wind.x * 0.18, -0.65, 0.65) + Math.sin(this.game.t * 2.3) * 0.05;
    this.angle = approach(this.angle, tilt, 8, dt);
    this.flash = Math.max(0, this.flash - dt * 4);

    this.tail.update(dt, kiteTailPoint(this.x, this.y, this.angle, this.size), wind.x * 260, 380, 0.96, 3);
    buildString(this.pts, this.ax, this.ay, this.x, this.y, 0.05, wind.x * 0.035);
  }
  get saw() { return Math.min(1.5, this.speed / SAW_REF); }
}

// ---------------- Layangan lawan dan perilakunya ----------------
class EnemyKite {
  constructor(game, key, person, mods) {
    const T = ETYPES[key];
    this.game = game; this.key = key; this.T = T; this.person = person;
    this.style = T.style || person.style;
    this.ax = person.hand.x; this.ay = person.hand.y;
    this.bx = this.ax; this.by = this.ay - 16; this.bvx = 0; this.bvy = -80;
    this.x = this.bx; this.y = this.by; this.px = this.x; this.py = this.y;
    this.hp = this.maxHp = T.hp * mods.hp;
    this.power = T.power * mods.power;
    this.vmax = T.vmax * mods.speed;
    this.size = T.size;
    this.state = 'rise'; this.stateT = 0; this.idleDur = rand(1.2, 2.5);
    this.home = this.pickHome();
    this.env = 0; this.sawPh = 0; this.sawing = false; this.burstT = 0; this.warn = false;
    this.contact = null; this.lostT = 0; this.fled = false;
    this.huntT = 0.6; this.huntExt = 1.4;
    this.speed = 0; this.angle = 0; this.flash = 0; this.t = rand(0, 10); this.phase = rand(0, TAU);
    this.life = 0;
    this.pts = new Array((STR_N + 1) * 2).fill(0);
    this.tail = Rope.hanging(this.x, this.y, T.boss ? 18 : 11, T.boss ? 12 : 8);
    this.dead = false; this.removed = false;
    buildString(this.pts, this.ax, this.ay, this.x, this.y, 0.05, 0);
  }
  pickHome() {
    const b = this.game.bounds;
    return { x: rand(b.x0 + 40, b.x1 - 40), y: rand(b.y0 + 20, lerp(b.y0, b.y1, 0.72)) };
  }
  setState(s) {
    this.state = s; this.stateT = 0;
    if (s !== 'saw') { this.sawing = false; this.warn = false; }
    if (s === 'idle') { this.idleDur = rand(1.4, 3.4); }
    if (s === 'hunt') { this.huntT = rand(0.45, 0.82); this.huntExt = rand(1.25, 1.55); }
    if (s === 'saw') { this.sawing = false; this.burstT = 0.5; this.lostT = 0; }
    if (s === 'flee') { this.home = this.pickHome(); this.fled = true; }
  }
  huntTarget() {
    const P = this.game.player;
    const i = Math.round(clamp(this.huntT, 0.2, 0.9) * STR_N);
    const cx = P.pts[i * 2], cy = P.pts[i * 2 + 1];
    return { x: this.ax + (cx - this.ax) * this.huntExt, y: this.ay + (cy - this.ay) * this.huntExt };
  }
  update(dt, wind) {
    const T = this.T, g = this.game, b = g.bounds;
    this.t += dt; this.stateT += dt; this.life += dt;
    let tx = this.home.x, ty = this.home.y;

    switch (this.state) {
      case 'rise':
        if (this.stateT > 3.2 || dist(this.bx, this.by, tx, ty) < 50) this.setState('idle');
        break;
      case 'idle':
        tx += Math.sin(this.t * 0.7 + this.phase) * 40;
        ty += Math.cos(this.t * 0.9 + this.phase) * 26;
        if (T.golden) {
          if (this.stateT > 1.6) { this.home = this.pickHome(); this.stateT = 0; }
          const P = g.player;
          const d = dist(P.x, P.y, this.bx, this.by);
          if (d < 220) {
            tx = this.bx + ((this.bx - P.x) / d) * 220;
            ty = this.by + ((this.by - P.y) / d) * 220;
          }
          if (this.life > 16) this.setState('leave');
        } else if (this.stateT > this.idleDur) {
          if (g.player.alive && Math.random() < T.aggr && g.canHunt(this)) this.setState('hunt');
          else { this.home = this.pickHome(); this.setState('idle'); }
        }
        break;
      case 'hunt': {
        const h = this.huntTarget(); tx = h.x; ty = h.y;
        if (this.contact) this.setState('saw');
        else if (this.stateT > 7 || !g.player.alive) { this.home = this.pickHome(); this.setState('idle'); }
        break;
      }
      case 'saw': {
        const h = this.huntTarget(); tx = h.x; ty = h.y;
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.sawing = !this.sawing;
          this.burstT = this.sawing ? rand(T.burst[0], T.burst[1]) : rand(T.rest[0], T.rest[1]);
        }
        this.warn = !this.sawing && this.burstT < (T.boss ? 0.7 : 0.45);
        if (!this.contact) {
          this.lostT += dt;
          if (this.lostT > 0.7) {
            if (!T.boss && !this.fled && this.hp < this.maxHp * 0.4 && Math.random() < 0.5) this.setState('flee');
            else if (Math.random() < T.aggr * 0.8) this.setState('hunt');
            else { this.home = this.pickHome(); this.setState('idle'); }
          }
        } else this.lostT = 0;
        if (!g.player.alive) this.setState('idle');
        break;
      }
      case 'flee':
        if (this.stateT > 2.4) this.setState('idle');
        break;
      case 'leave':
        tx = this.bx; ty = -260;
        if (this.y < -60) this.removed = true;
        break;
    }
    if (T.erratic && this.state !== 'leave') {
      tx += Math.sin(this.t * 5.1 + this.phase) * 46;
      ty += Math.cos(this.t * 4.3 + this.phase) * 30;
    }
    if (this.state !== 'leave') {
      tx = clamp(tx, b.x0, b.x1);
      ty = clamp(ty, b.y0, b.y1);
    }

    // gerak dasar (pegas teredam)
    const k = T.k * (this.state === 'rise' ? 0.6 : 1);
    const c = 2 * Math.sqrt(k) * 0.9;
    let ax = (tx - this.bx) * k - this.bvx * c + wind.x * 320;
    let ay = (ty - this.by) * k - this.bvy * c + Math.sin(this.t * 1.4 + this.phase) * 8 * k;
    this.bvx += ax * dt; this.bvy += ay * dt;
    const vm = Math.hypot(this.bvx, this.bvy);
    if (vm > this.vmax) { this.bvx *= this.vmax / vm; this.bvy *= this.vmax / vm; }
    this.bx += this.bvx * dt; this.by += this.bvy * dt;
    if (this.state !== 'leave') {
      this.bx = clamp(this.bx, b.x0 - 10, b.x1 + 10);
      this.by = clamp(this.by, b.y0 - 10, b.y1 + 20);
    }

    // gesekan: layangan maju-mundur searah benang (tarik-ulur)
    this.env = approach(this.env, this.sawing ? 1 : 0, 10, dt);
    this.sawPh += T.w * dt;
    let ux = this.bx - this.ax, uy = this.by - this.ay;
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const off = Math.sin(this.sawPh) * T.amp * this.env;
    this.x = this.bx + ux * off; this.y = this.by + uy * off;

    // Kekuatan gesek lawan terutama dari gerakan tarik-ulur yang disengaja (ada tanda "!"),
    // gerak melayang biasa hanya menyumbang sedikit.
    const osc = Math.abs(Math.cos(this.sawPh)) * T.amp * T.w * this.env;
    const drift = Math.hypot(this.bvx, this.bvy) * 0.2;
    this.speed = approach(this.speed, osc + drift, 14, dt);
    this.px = this.x; this.py = this.y;

    const tilt = clamp(this.bvx * 0.0012 + wind.x * 0.18, -0.6, 0.6) + Math.sin(this.t * 2.1 + this.phase) * 0.06;
    this.angle = approach(this.angle, tilt, 6, dt);
    this.flash = Math.max(0, this.flash - dt * 5);
    this.tail.update(dt, kiteTailPoint(this.x, this.y, this.angle, this.size), wind.x * 260, 380, 0.96, 3);
    buildString(this.pts, this.ax, this.ay, this.x, this.y, 0.05, wind.x * 0.035);
  }
  get saw() { return Math.min(1.5, this.speed / SAW_REF) * this.power; }
}

// ---------------- Layangan putus (melayang jatuh) ----------------
class LooseKite {
  constructor(src, ropePts, ropeLen, catchable) {
    this.x = src.x; this.y = src.y;
    this.vx = (src.vx || 0) * 0.3; this.vy = -40;
    this.angle = src.angle; this.size = src.size; this.style = src.style;
    this.tail = src.tail;
    const n = ropePts.length;
    this.rope = new Rope(ropePts, Math.max(4, ropeLen / Math.max(1, n - 1)));
    this.catchable = catchable;
    this.t = 0; this.ph = rand(0, TAU);
    this.landed = false; this.landT = 0; this.alpha = 1;
    this.caught = false; this.claimed = false; this.removed = false;
    this.big = !!src.T && !!src.T.boss;
  }
  update(dt, wind) {
    this.t += dt;
    if (!this.landed) {
      this.vx = approach(this.vx, wind.x * 120 + Math.sin(this.t * 0.9 + this.ph) * 40, 1.0, dt);
      this.vy = approach(this.vy, 38 + Math.sin(this.t * 2.2 + this.ph) * 46, 1.4, dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.angle = approach(this.angle, Math.sin(this.t * 2.4 + this.ph) * 0.8 + this.vx * 0.002, 4, dt);
      if (this.y >= Scene.baseY + 6) {
        this.landed = true; this.y = Scene.baseY + 6;
      }
    } else {
      this.landT += dt;
      this.angle = approach(this.angle, 1.25, 6, dt);
      if (this.landT > 5) this.alpha -= dt * 0.8;
      if (this.alpha <= 0) this.removed = true;
    }
    this.rope.update(dt, { x: this.x, y: this.y }, wind.x * 150, 260, 0.96, 3);
    this.tail.update(dt, kiteTailPoint(this.x, this.y, this.angle, this.size), wind.x * 200, 380, 0.96, 3);
    if (this.x < -160 || this.x > Scene.W + 160) this.removed = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.alpha, 0, 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.1;
    this.rope.path(ctx);
    ctx.stroke();
    drawTail(ctx, this.tail, this.size, this.style.tail || this.style.b, clamp(this.alpha, 0, 1));
    const glow = this.catchable && !this.landed ? 'rgba(255,240,150,0.9)' : null;
    drawKite(ctx, { x: this.x, y: this.y, angle: this.angle, size: this.size, style: this.style, glow, glowBlur: 10 + Math.sin(this.t * 6) * 6, t: this.t });
    ctx.restore();
  }
}

// ---------------- Potongan benang yang jatuh ----------------
class Remnant {
  constructor(points, length, pin, color, width) {
    this.rope = new Rope(points, Math.max(3, length / Math.max(1, points.length - 1)));
    this.pin = pin; this.color = color; this.width = width;
    this.life = 2.6; this.removed = false;
  }
  update(dt, wind) {
    this.life -= dt;
    if (this.life <= 0) this.removed = true;
    this.rope.update(dt, this.pin, wind.x * 60, 420, 0.985, 3);
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life / 0.9, 0, 1);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineJoin = 'round';
    this.rope.path(ctx);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------- Anak-anak pengejar layangan putus ----------------
const KID_SHIRTS = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b', '#ffffff', '#83c5be'];
class Kid {
  constructor(target) {
    this.target = target;
    const fromLeft = target.x > Scene.W * 0.5 ? Math.random() < 0.35 : Math.random() < 0.65;
    this.x = fromLeft ? -20 - rand(0, 60) : Scene.W + 20 + rand(0, 60);
    this.dir = fromLeft ? 1 : -1;
    this.speed = rand(90, 135);
    this.state = 'run'; this.timer = 0; this.t = rand(0, 10);
    this.shirt = pick(KID_SHIRTS); this.skin = pick(SKINS);
    this.has = null; this.removed = false;
  }
  update(dt) {
    this.t += dt;
    const tg = this.target;
    if (this.state === 'run') {
      if (!tg || tg.caught || tg.claimed || (tg.removed && !tg.claimed)) {
        this.state = 'sad'; this.timer = 0.9;
      } else {
        const dx = tg.x - this.x;
        if (Math.abs(dx) > 3) this.dir = Math.sign(dx);
        const sp = Math.abs(dx) < 40 ? this.speed * 0.5 : this.speed;
        this.x += this.dir * Math.min(Math.abs(dx), sp * dt);
        if (tg.landed && Math.abs(dx) < 16) {
          tg.claimed = true; tg.removed = true;
          this.has = tg.style; this.state = 'win'; this.timer = 1.1;
        }
      }
    } else if (this.state === 'sad' || this.state === 'win') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'leave'; this.dir = this.x < Scene.W / 2 ? -1 : 1; }
    } else {
      this.x += this.dir * this.speed * 1.1 * dt;
      if (this.x < -60 || this.x > Scene.W + 60) this.removed = true;
    }
  }
  draw(ctx) {
    const shade = Scene.col.shade || [255, 255, 255];
    const running = this.state === 'run' || this.state === 'leave';
    const jump = this.state === 'win' ? Math.abs(Math.sin(this.t * 9)) * 7 : 0;
    const x = this.x, fy = Scene.streetY - jump;
    const sw = running ? Math.sin(this.t * 16) * 5 : 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mulRgb([50, 50, 70], shade)); ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, fy - 8); ctx.lineTo(x + sw, fy);
    ctx.moveTo(x, fy - 8); ctx.lineTo(x - sw, fy);
    ctx.stroke();
    ctx.strokeStyle = rgba(mulRgb(hexToRgb(this.shirt), shade)); ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(x, fy - 9); ctx.lineTo(x, fy - 16); ctx.stroke();
    ctx.strokeStyle = rgba(mulRgb(hexToRgb(this.skin), shade)); ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (this.state === 'win' || (running && this.state === 'run')) {
      ctx.moveTo(x, fy - 15); ctx.lineTo(x - 4, fy - 24);
      ctx.moveTo(x, fy - 15); ctx.lineTo(x + 4, fy - 24);
    } else {
      ctx.moveTo(x, fy - 15); ctx.lineTo(x - 3 * this.dir, fy - 9);
      ctx.moveTo(x, fy - 15); ctx.lineTo(x + 3 * this.dir, fy - 9);
    }
    ctx.stroke();
    ctx.fillStyle = rgba(mulRgb(hexToRgb(this.skin), shade));
    const sad = this.state === 'sad';
    ctx.beginPath(); ctx.arc(x + (sad ? 1 : 0), fy - 20 + (sad ? 1 : 0), 3.6, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.has) {
      drawKite(ctx, { x, y: fy - 32, angle: Math.sin(this.t * 5) * 0.2, size: 7, style: this.has });
    }
  }
}

// ---------------- Partikel & teks melayang ----------------
const FX = {
  parts: [], texts: [],
  clear() { this.parts.length = 0; this.texts.length = 0; },
  spark(x, y, n, color, spd = 220) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * spd;
      this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.2, 0.45), max: 0.45, color, size: rand(1.2, 2.4) });
    }
  },
  confetti(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(60, 280);
      this.parts.push({ type: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rand(0.8, 1.5), max: 1.5, color: pick(colors), size: rand(3, 6), rot: rand(0, TAU), vr: rand(-10, 10) });
    }
  },
  ring(x, y, color, r = 40) {
    this.parts.push({ type: 'ring', x, y, life: 0.45, max: 0.45, color, size: r });
  },
  text(x, y, str, color = '#fff', size = 22, life = 1.1) {
    this.texts.push({ x, y, str, color, size, life, max: life });
  },
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.type === 'spark') {
        p.vx *= Math.exp(-4 * dt); p.vy = p.vy * Math.exp(-4 * dt) + 300 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.type === 'conf') {
        p.vx *= Math.exp(-2.2 * dt); p.vy = p.vy * Math.exp(-2.2 * dt) + 220 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 36 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  },
  draw(ctx) {
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'spark') {
        ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.type === 'conf') {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - a * 0.9), 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const a = clamp(t.life / (t.max * 0.4), 0, 1);
      const pop = 1 + Math.max(0, (t.life - t.max + 0.15) / 0.15) * 0.35;
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(t.size * pop)}px "Baloo 2", "Trebuchet MS", sans-serif`;
      ctx.strokeStyle = 'rgba(30,18,50,0.85)'; ctx.lineWidth = 4;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};
