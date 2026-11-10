'use strict';
// ================= Tampilan, HUD, kontrol, dan loop utama =================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), hudButtons: $('hud-buttons'),
  hpBar: $('hp-bar'), hpFill: $('hp-fill'),
  score: $('score'), combo: $('combo'), wave: $('wave'),
  windArrow: $('wind-arrow'), windText: $('wind-text'),
  banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
  hint: $('hint'),
  title: $('screen-title'), pause: $('screen-pause'), over: $('screen-over'),
  bestTitle: $('best-title'), mute: $('btn-mute'),
};
const hud = {};
const fmt = (n) => Math.round(n).toLocaleString('id-ID');

if (matchMedia('(pointer: coarse)').matches) {
  Game.pointerMode = 'touch';
  document.body.classList.add('touch');
}

// ---------- Helper UI ----------
Object.assign(Game, {
  hintVisible: false, hintTimer: 0, displayScore: 0,

  showBanner(title, sub) {
    ui.bannerTitle.textContent = title;
    ui.bannerSub.textContent = sub || '';
    ui.banner.classList.add('hidden');
    void ui.banner.offsetWidth; // ulangi animasi
    ui.banner.classList.remove('hidden');
  },
  hideBanner() { ui.banner.classList.add('hidden'); },

  setHint(html, duration = 0) {
    if (!html) {
      ui.hint.classList.add('hidden');
      this.hintVisible = false;
      this.hintTimer = 0;
      return;
    }
    if (ui.hint.innerHTML !== html || ui.hint.classList.contains('hidden')) {
      ui.hint.innerHTML = html;
      ui.hint.classList.add('hidden');
      void ui.hint.offsetWidth;
      ui.hint.classList.remove('hidden');
    }
    this.hintVisible = true;
    this.hintTimer = duration;
  },

  flashHpBar() {
    ui.hpBar.classList.remove('hit');
    void ui.hpBar.offsetWidth;
    ui.hpBar.classList.add('hit');
  },
  popCombo() {
    ui.combo.classList.remove('pop');
    void ui.combo.offsetWidth;
    ui.combo.classList.add('pop');
  },

  showGameOver(isBest) {
    $('final-score').textContent = fmt(this.score);
    $('st-wave').textContent = this.wave;
    $('st-cut').textContent = this.cuts;
    $('st-catch').textContent = this.caught;
    $('st-combo').textContent = this.bestCombo;
    $('new-best').classList.toggle('hidden', !isBest);
    ui.hud.classList.add('hidden');
    ui.hudButtons.classList.add('hidden');
    this.setHint(null);
    this.hideBanner();
    ui.over.classList.remove('hidden');
    setTimeout(() => $('btn-retry').focus({ preventScroll: true }), 50);
  },

  updateHUD(dt) {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.setHint(null);
    }
    if (this.state !== 'play' && this.state !== 'paused') return;
    const P = this.player;
    const hp = Math.max(0, Math.ceil(P.hp));
    if (hp !== hud.hp) {
      hud.hp = hp;
      ui.hpFill.style.width = hp + '%';
      ui.hpBar.classList.toggle('low', hp < 30);
      ui.hpBar.classList.toggle('mid', hp >= 30 && hp < 60);
    }
    this.displayScore = approach(this.displayScore, this.score, 9, dt);
    if (Math.abs(this.displayScore - this.score) < 1) this.displayScore = this.score;
    const ds = Math.round(this.displayScore);
    if (ds !== hud.score) { hud.score = ds; ui.score.textContent = fmt(ds); }
    const ct = this.combo >= 2 && this.t - this.lastCutT < 4 ? 'COMBO x' + this.combo : '';
    if (ct !== hud.combo) { hud.combo = ct; ui.combo.textContent = ct; }
    if (this.wave !== hud.wave) { hud.wave = this.wave; ui.wave.textContent = 'Ronde ' + this.wave; }
    const w = this.wind.x, a = Math.abs(w);
    const wl = (w < 0 ? 'L' : 'R') + (a < 0.3 ? 0 : a < 0.7 ? 1 : 2);
    if (wl !== hud.wind) {
      hud.wind = wl;
      ui.windArrow.style.transform = w < 0 ? 'scaleX(-1)' : 'none';
      ui.windText.textContent = a < 0.3 ? 'Angin tenang' : a < 0.7 ? 'Angin sedang' : 'Angin kencang';
    }
  },
});

// ---------- Gambar ----------
function drawContact(e, t) {
  const c = e.contact;
  const r = e.T.boss ? 16 : 12;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20,10,40,0.45)';
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = e.sawing ? '#ff6b6b' : '#ffd166';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e.hp / e.maxHp, 0, 1));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(c.x, c.y, 2.6 + Math.sin(t * 20) * 0.8, 0, TAU); ctx.fill();
}

function drawLabel(text, x, y, color, size) {
  ctx.font = `800 ${size}px "Baloo 2", "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(30,18,50,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

Game.render = function () {
  const s = this.scale, dpr = this.dpr, t = this.t;
  BLUR_SCALE = s * dpr;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  ctx.save();
  if (this.shake > 0.1) ctx.translate(rand(-1, 1) * this.shake * 0.6, rand(-1, 1) * this.shake * 0.6);

  Scene.drawSky(ctx, t, this.wind);
  Scene.drawLand(ctx, t, this.wind);
  for (const k of this.kids) k.draw(ctx);
  for (const p of this.people) {
    Scene.drawPerson(ctx, p.slot.cx, p.slot.ridgeY, p.shirt, p.skin, { alpha: p.alpha, mood: p.mood, t });
  }
  Scene.drawPerson(ctx, this.playerFeet.x, this.playerFeet.y, '#e63946', '#a0662f', { cap: true, mood: this.playerMood, t });
  for (const r of this.remnants) r.draw(ctx);

  // benang lawan
  for (const e of this.enemies) {
    const col = e.sawing ? 'rgba(255,107,107,0.95)' : rgba(mixRgb(hexToRgb(e.style.a), [255, 255, 255], 0.45), 0.85);
    drawString(ctx, e.pts, col, e.T.boss ? 1.8 : 1.25, null);
  }
  for (const L of this.loose) L.draw(ctx);

  // benang pemain
  const P = this.player;
  if (P.alive) {
    const col = P.flash > 0.05 ? rgba(mixRgb([255, 255, 255], [255, 80, 90], Math.min(1, P.flash * 1.5))) : '#ffffff';
    drawString(ctx, P.pts, col, 1.7, 'rgba(255,255,255,0.15)');
  }
  for (const e of this.enemies) if (e.contact) drawContact(e, t);

  // layangan lawan
  for (const e of this.enemies) {
    drawTail(ctx, e.tail, e.size, e.style.tail || e.style.b);
    const glow = e.sawing ? 'rgba(255,60,60,0.95)' : e.T.golden ? 'rgba(255,220,80,0.95)' : null;
    drawKite(ctx, { x: e.x, y: e.y, angle: e.angle, size: e.size, style: e.style, glow, glowBlur: e.T.boss ? 26 : 16, flash: e.flash, t });
    if (e.hp < e.maxHp && !e.T.boss) {
      const w = e.size * 1.7, x = e.x - w / 2, y = e.y - e.size * 1.2 - 12;
      ctx.fillStyle = 'rgba(20,10,40,0.6)';
      ctx.fillRect(x - 1.5, y - 1.5, w + 3, 7);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
    if (this.state === 'play' && (e.warn || e.sawing)) {
      const blink = e.sawing ? 1 : Math.sin(t * 30) > 0 ? 1 : 0.35;
      ctx.globalAlpha = blink;
      drawLabel('!', e.x + e.size * 0.95, e.y - e.size * 0.95, '#ff5a5f', e.T.boss ? 30 : 22);
      ctx.globalAlpha = 1;
    }
  }

  // layangan pemain
  if (P.alive) {
    drawTail(ctx, P.tail, P.size, P.style.tail);
    drawKite(ctx, { x: P.x, y: P.y, angle: P.angle, size: P.size, style: P.style, glow: 'rgba(255,255,255,0.85)', glowBlur: 12, flash: P.flash * 0.6, t });
    if (this.state === 'play' && t < 5) {
      ctx.globalAlpha = clamp(5 - t, 0, 1);
      drawLabel('KAMU', P.x, P.y - P.size * 1.15 - 16, '#ffd166', 16);
      ctx.globalAlpha = 1;
    }
  }
  FX.draw(ctx);
  ctx.restore();

  // bar nyawa bos (koordinat layar)
  const boss = this.state === 'play' ? this.enemies.find((e) => e.T.boss && !e.dead) : null;
  if (boss) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = canvas.width / dpr;
    const bw = Math.min(cw * 0.6, 380), bx = (cw - bw) / 2, by = cw < 560 ? 120 : 92;
    ctx.fillStyle = 'rgba(20,10,40,0.6)';
    ctx.fillRect(bx - 3, by - 3, bw + 6, 16);
    ctx.fillStyle = '#ef233c';
    ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 10);
    drawLabel('LAYANGAN RAKSASA', cw / 2, by - 12, '#ffffff', 15);
  }
};

// ---------- Alur layar ----------
function startGame() {
  Sound.init();
  Sound.click();
  ui.title.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.hudButtons.classList.remove('hidden');
  for (const k in hud) delete hud[k];
  Game.startGame();
}
function toMenu() {
  Sound.click();
  Sound.setSaw(0);
  ui.over.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.hudButtons.classList.add('hidden');
  Game.setHint(null);
  Game.hideBanner();
  Game.setupTitle();
  ui.bestTitle.textContent = fmt(Game.best);
  ui.title.classList.remove('hidden');
}
function pauseGame() {
  if (Game.state !== 'play' || Game.dyingT > 0) return;
  Game.state = 'paused';
  Sound.setSaw(0);
  ui.pause.classList.remove('hidden');
}
function resumeGame() {
  if (Game.state !== 'paused') return;
  Sound.init();
  Game.state = 'play';
  ui.pause.classList.add('hidden');
}
function toggleMute() {
  Sound.init();
  Sound.setMuted(!Sound.muted);
  ui.mute.innerHTML = Sound.muted ? '&#128263;' : '&#128266;';
}
ui.mute.innerHTML = Sound.muted ? '&#128263;' : '&#128266;';

$('btn-start').addEventListener('click', startGame);
$('btn-retry').addEventListener('click', startGame);
$('btn-menu').addEventListener('click', toMenu);
$('btn-quit').addEventListener('click', toMenu);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-pause').addEventListener('click', () => (Game.state === 'paused' ? resumeGame() : pauseGame()));
$('btn-mute').addEventListener('click', toggleMute);

// ---------- Input ----------
const toWorld = (e) => ({ x: e.clientX / Game.scale, y: e.clientY / Game.scale });
let touchId = null, lastTouch = null;

function aimMouse(e) {
  if (Game.state !== 'play' || !Game.player.alive) return;
  const p = toWorld(e);
  Game.player.tx = p.x;
  Game.player.ty = p.y;
}
canvas.addEventListener('pointerdown', (e) => {
  Sound.init();
  if (e.pointerType === 'touch') {
    Game.pointerMode = 'touch';
    document.body.classList.add('touch');
    if (touchId === null) { touchId = e.pointerId; lastTouch = toWorld(e); }
  } else {
    Game.pointerMode = 'mouse';
    aimMouse(e);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (e.pointerId !== touchId) return;
    const p = toWorld(e);
    if (Game.state === 'play' && Game.player.alive) {
      Game.player.tx += (p.x - lastTouch.x) * 1.6;
      Game.player.ty += (p.y - lastTouch.y) * 1.6;
    }
    lastTouch = p;
  } else {
    aimMouse(e);
  }
});
const endTouch = (e) => { if (e.pointerId === touchId) touchId = null; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (k) {
    Game.keys[k] = true;
    if (Game.state === 'play') e.preventDefault();
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (Game.state === 'play') pauseGame();
    else if (Game.state === 'paused') resumeGame();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  } else if ((e.key === 'Enter' || e.key === ' ') && Game.state === 'title') {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key];
  if (k) Game.keys[k] = false;
});
window.addEventListener('blur', () => {
  for (const k in Game.keys) Game.keys[k] = false;
  pauseGame();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------- Ukuran layar ----------
function resize() {
  // ukuran bisa 0 sesaat saat halaman baru dimuat; event resize berikutnya akan memperbaikinya
  const cw = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
  const ch = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 0);
  Game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * Game.dpr);
  canvas.height = Math.round(ch * Game.dpr);
  Game.layout(cw, ch);
}
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});

// ---------- Loop ----------
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.04, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (Game.state !== 'paused') Game.update(dt * Game.timeScale);
  Game.updateHUD(dt);
  Game.render();
  requestAnimationFrame(frame);
}

resize();
Game.setupTitle();
ui.bestTitle.textContent = fmt(Game.best);
requestAnimationFrame(frame);
