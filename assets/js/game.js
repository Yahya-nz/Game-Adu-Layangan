'use strict';
// ================= Logika inti: ronde, adu benang, skor =================

const PERSON_SHIRTS = ['#118ab2', '#06d6a0', '#8338ec', '#fb5607', '#3a86ff', '#ffbe0b', '#2a9d8f', '#f72585'];

const Game = {
  state: 'title', // title | play | paused | over
  W: 0, H: 0, scale: 1, dpr: 1,
  t: 0, timeScale: 1,
  bounds: { x0: 0, x1: 0, y0: 0, y1: 0 },
  wind: { x: 0.45, target: 0.45, timer: 6 },
  player: null,
  enemies: [], loose: [], remnants: [], kids: [], people: [], slots: [],
  wave: 0, wavePhase: 'banner', phaseT: 0, toSpawn: [], spawnT: 0, maxActive: 2,
  goldenPending: false, goldenT: 0,
  mods: { hp: 1, power: 1, speed: 1 },
  score: 0, cuts: 0, caught: 0, combo: 0, bestCombo: 0, lastCutT: -99,
  shake: 0, sawLevel: 0, sparkAcc: 0, dyingT: 0,
  lastHurtT: -9, lastWarnBeep: -9, hurtHintShown: false,
  best: Store.get('best', 0),
  tutorial: !Store.get('tutorialDone', false), tutStep: -1, tutT: 0,
  keys: { left: false, right: false, up: false, down: false },
  pointerMode: 'mouse',

  // ---------- Tata letak ----------
  layout(cw, ch) {
    const s = Math.min(cw / 540, ch / 720);
    this.scale = s;
    this.W = cw / s;
    this.H = ch / s;
    Scene.build(this.W, this.H);
    let minRidge = Infinity;
    for (const h of Scene.houses) {
      if (h.cx > 0 && h.cx < this.W) minRidge = Math.min(minRidge, h.ridgeY);
    }
    this.bounds = { x0: 26, x1: this.W - 26, y0: 64, y1: minRidge - 40 };
    const ph = Scene.playerHouse;
    this.playerFeet = { x: ph.cx, y: ph.ridgeY };
    this.playerHand = Scene.personHand(ph.cx, ph.ridgeY);
    this.slots = Scene.houses.filter((h) => !h.player && h.cx > 34 && h.cx < this.W - 34 && Math.abs(h.cx - ph.cx) > 100);
    if (!this.slots.length) this.slots = Scene.houses.filter((h) => !h.player && h.cx > 0 && h.cx < this.W);

    // pindahkan semua jangkar ke rumah yang baru
    if (this.player) {
      this.player.setAnchor(this.playerHand);
      this.player.tx = clamp(this.player.tx, this.bounds.x0, this.bounds.x1);
      this.player.ty = clamp(this.player.ty, this.bounds.y0, this.bounds.y1);
    }
    for (const s2 of this.slots) s2.busy = false;
    for (const p of this.people) {
      p.slot = this.freeSlot();
      p.slot.busy = true;
      p.hand = Scene.personHand(p.slot.cx, p.slot.ridgeY);
    }
    for (const e of this.enemies) { e.ax = e.person.hand.x; e.ay = e.person.hand.y; }
  },

  freeSlot() {
    const free = this.slots.filter((s) => !s.busy);
    return free.length ? pick(free) : pick(this.slots);
  },
  freeSlotCount() {
    return this.slots.filter((s) => !s.busy).length;
  },

  makePerson(style) {
    const slot = this.freeSlot();
    slot.busy = true;
    const p = {
      slot, hand: Scene.personHand(slot.cx, slot.ridgeY),
      shirt: style && style.a !== '#22223b' && style.a !== '#2b2d42' ? style.a : pick(PERSON_SHIRTS),
      skin: pick(SKINS), alpha: 0, mood: 'fly', leaveT: 0, removed: false, style,
    };
    if (style === HUNTER_STYLE || style === BOSS_STYLE) p.shirt = '#2b2d42';
    this.people.push(p);
    return p;
  },

  spawnEnemy(key) {
    const T = ETYPES[key];
    const style = T.style || pick(ENEMY_STYLES);
    const person = this.makePerson(style);
    person.style = style;
    const e = new EnemyKite(this, key, person, this.mods);
    this.enemies.push(e);
    return e;
  },

  // ---------- Mulai / ronde ----------
  resetWorld() {
    this.enemies = []; this.loose = []; this.remnants = []; this.kids = []; this.people = [];
    for (const s of this.slots) s.busy = false;
    FX.clear();
    if (!this.player) this.player = new PlayerKite(this);
    this.player.reset(this.playerHand);
    this.playerMood = 'fly';
  },

  setupTitle() {
    this.state = 'title';
    this.timeScale = 1;
    this.wave = 0;
    this.mods = { hp: 1, power: 1, speed: 1 };
    this.resetWorld();
    Scene.todTarget = 0.42;
    for (let i = 0; i < Math.min(3, this.slots.length); i++) {
      const e = this.spawnEnemy(pick(['pemula', 'jagoan', 'lincah']));
      e.person.alpha = 1;
    }
  },

  startGame() {
    this.resetWorld();
    this.state = 'play';
    this.timeScale = 1;
    this.score = 0; this.displayScore = 0; this.cuts = 0; this.caught = 0;
    this.combo = 0; this.bestCombo = 0; this.lastCutT = -99;
    this.dyingT = 0; this.shake = 0; this.hurtHintShown = false; this.minHp = 100;
    this.t = 0;
    this.wind.x = 0.45; this.wind.target = 0.45; this.wind.timer = 7;
    Scene.tod = 0; Scene.todTarget = 0;
    this.tutorial = !Store.get('tutorialDone', false);
    this.tutStep = -1;
    if (this.tutorial) this.setTut(0);
    else this.setHint(null);
    this.startWave(1);
  },

  startWave(n) {
    this.wave = n;
    const boss = n % 5 === 0;
    // ronde bos: lawan biasa lebih sedikit supaya bos tidak main keroyok
    const count = boss ? 2 + Math.floor(n / 5) : 3 + n;
    const list = [];
    for (let i = 0; i < count; i++) list.push(this.pickType(n));
    if (boss) list.splice(1, 0, 'raksasa');
    this.toSpawn = list;
    this.maxActive = boss ? 2 + Math.floor(n / 10) : Math.min(2 + Math.floor((n - 1) / 2), 6);
    this.goldenPending = n >= 2 && Math.random() < 0.4;
    this.goldenT = rand(6, 16);
    this.wavePhase = 'banner';
    this.phaseT = 0;
    this.spawnT = 0.3;
    this.mods = {
      hp: 1 + 0.08 * (n - 1),
      power: Math.min(1.6, 1 + 0.05 * (n - 1)),
      speed: Math.min(1.35, 1 + 0.03 * (n - 1)),
    };
    Scene.todTarget = clamp((n - 1) / 9, 0, 1);
    const subs = ['Putuskan semua layangan lawan!', 'Angin makin kencang...', 'Lawan makin jago!', 'Jangan lengah!'];
    this.showBanner(boss ? 'RONDE ' + n : 'Ronde ' + n, boss ? 'Awas! Layangan Raksasa datang!' : n === 1 ? subs[0] : pick(subs.slice(1)));
    Sound.tok(boss ? 3 : 2);
  },

  pickType(n) {
    const w = {
      pemula: Math.max(0.6, 4 - n * 0.6),
      lincah: n >= 2 ? 1.2 : 0,
      jagoan: n >= 3 ? 1.4 + n * 0.1 : 0,
      pemburu: n >= 4 ? 0.5 + n * 0.15 : 0,
    };
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'pemula';
  },

  activeCount() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead && !e.T.golden) n++;
    return n;
  },

  canHunt(e) {
    if (this.state !== 'play' || !this.player.alive) return false;
    let n = 0;
    for (const o of this.enemies) if (o !== e && !o.dead && (o.state === 'hunt' || o.state === 'saw')) n++;
    return n < 1 + Math.floor(this.wave / 3);
  },

  addScore(v) { this.score += v; },

  // ---------- Update ----------
  update(dt) {
    this.t += dt;
    this.updateWind(dt);
    Scene.update(dt, this.wind, this.t);
    const P = this.player;
    const playing = this.state === 'play';

    if (this.state === 'title') {
      // layangan demo bergerak sendiri
      P.tx = this.W * 0.5 + Math.sin(this.t * 0.45) * this.W * 0.3;
      P.ty = lerp(this.bounds.y0, this.bounds.y1, 0.35 + Math.sin(this.t * 0.8) * 0.2);
    }
    if (P.alive) {
      const k = this.keys;
      const keys = playing ? { x: (k.right ? 1 : 0) - (k.left ? 1 : 0), y: (k.down ? 1 : 0) - (k.up ? 1 : 0) } : { x: 0, y: 0 };
      P.update(dt, this.wind, this.bounds, keys);
    }

    for (const e of this.enemies) e.update(dt, this.wind);
    if (playing && P.alive) this.handleContacts(dt);
    else {
      for (const e of this.enemies) e.contact = null;
      this.sawLevel = approach(this.sawLevel, 0, 10, dt);
      Sound.setSaw(this.sawLevel);
    }

    // tangkap layangan putus
    if (playing && P.alive) {
      for (const L of this.loose) {
        if (!L.catchable || L.landed || L.caught || L.removed) continue;
        if (dist(P.x, P.y, L.x, L.y) < (P.size + L.size) * 0.9) this.catchLoose(L);
      }
    }
    for (const L of this.loose) L.update(dt, this.wind);
    for (const r of this.remnants) r.update(dt, this.wind);
    for (const kd of this.kids) kd.update(dt);
    this.updatePeople(dt);

    this.enemies = this.enemies.filter((e) => !e.removed);
    this.loose = this.loose.filter((l) => !l.removed);
    this.remnants = this.remnants.filter((r) => !r.removed);
    this.kids = this.kids.filter((k) => !k.removed);

    if (playing) {
      this.updateWave(dt);
      this.updateTutorial(dt);
      if (P.alive && P.hp < 25 && this.t - this.lastWarnBeep > 1.1) { this.lastWarnBeep = this.t; Sound.warn(); }
      if (this.dyingT > 0) {
        this.dyingT -= dt / Math.max(this.timeScale, 0.01);
        this.timeScale = approach(this.timeScale, 1, 1.2, dt);
        if (this.dyingT <= 0) this.gameOver();
      }
    }
    FX.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    Sound.setWind(Math.min(1, Math.abs(this.wind.x)));
  },

  updateWind(dt) {
    const w = this.wind;
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = rand(5, 10);
      const strong = Math.min(1, 0.55 + this.wave * 0.05);
      w.target = Math.random() < 0.2 ? -rand(0.2, 0.7) : rand(0.15, strong);
    }
    w.x = approach(w.x, w.target + Math.sin(this.t * 0.6) * 0.08, 0.5, dt);
  },

  updatePeople(dt) {
    for (const p of this.people) {
      if (p.mood === 'sad') {
        p.leaveT -= dt;
        if (p.leaveT <= 0) {
          p.alpha -= dt * 2;
          if (p.alpha <= 0) { p.removed = true; p.slot.busy = false; }
        }
      } else p.alpha = Math.min(1, p.alpha + dt * 2.5);
    }
    this.people = this.people.filter((p) => !p.removed);
  },

  updateWave(dt) {
    if (this.dyingT > 0 || !this.player.alive) return;
    this.phaseT += dt;
    if (this.wavePhase === 'banner') {
      if (this.phaseT > 2.2) { this.wavePhase = 'fight'; this.phaseT = 0; this.hideBanner(); }
      return;
    }
    if (this.wavePhase === 'fight') {
      this.spawnT -= dt;
      const cap = Math.min(this.maxActive, this.activeCount() + this.freeSlotCount());
      if (this.toSpawn.length && this.spawnT <= 0 && this.activeCount() < cap) {
        this.spawnEnemy(this.toSpawn.shift());
        this.spawnT = rand(0.9, 2.1);
      }
      if (this.goldenPending) {
        this.goldenT -= dt;
        if (this.goldenT <= 0 && this.freeSlotCount() > 0) {
          this.goldenPending = false;
          this.spawnEnemy('emas');
          FX.text(this.W / 2, this.bounds.y0 + 40, 'Layangan EMAS muncul!', '#ffd166', 24, 2);
        }
      }
      if (!this.toSpawn.length && this.activeCount() === 0) {
        this.wavePhase = 'clear'; this.phaseT = 0;
        const bonus = 100 * this.wave;
        this.addScore(bonus);
        const heal = Math.min(25, this.player.maxHp - this.player.hp);
        this.player.hp += heal;
        this.showBanner('Ronde ' + this.wave + ' beres!', '+' + bonus + ' poin' + (heal > 0 ? '  ·  benang +' + Math.round(heal) : ''));
        Sound.tok(1);
      }
      return;
    }
    if (this.wavePhase === 'clear' && this.phaseT > 2.6) {
      // layangan emas yang belum terputus terbang pergi
      for (const e of this.enemies) if (e.T.golden && e.state !== 'leave') e.setState('leave');
      this.startWave(this.wave + 1);
    }
  },

  // ---------- Adu benang ----------
  handleContacts(dt) {
    const P = this.player;
    let sawTotal = 0;
    for (const e of this.enemies) {
      e.contact = null;
      if (e.dead || e.state === 'leave') continue;
      const c = polyIntersect(P.pts, e.pts);
      if (!c || c.y > this.bounds.y1 + 30) continue;
      e.contact = c;
      const sp = P.saw, se = e.saw;
      sawTotal += sp + se;
      e.hp -= sp * PLAYER_DMG * dt;
      // gesek balik = bertahan: makin kencang kamu menggesek, makin kecil kerusakan yang kamu terima
      const guard = clamp(sp / (se + 0.3), 0, 1) * 0.6;
      const dmg = se * ENEMY_DMG * dt * (1 - guard);
      P.hp -= dmg;
      this.minHp = Math.min(this.minHp, P.hp);
      if (dmg > 0.02) {
        P.flash = Math.min(1, P.flash + dmg * 0.15);
        this.onHurt();
      }
      if (sp > 0.2) e.flash = Math.min(0.7, e.flash + sp * dt * 3);
      this.sparkAcc += (sp + se) * dt * 45;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        FX.spark(c.x, c.y, 1, sp >= se ? '#ffd166' : '#ff5a5f', 160 + (sp + se) * 120);
      }
      if (this.tutStep === 1) this.setTut(2);
      if (e.hp <= 0) this.cutEnemy(e, c);
      else if (P.hp <= 0) { this.cutPlayer(c); break; }
    }
    this.sawLevel = approach(this.sawLevel, sawTotal, 20, dt);
    Sound.setSaw(this.sawLevel);
  },

  onHurt() {
    if (this.t - this.lastHurtT > 0.35) {
      this.lastHurtT = this.t;
      Sound.hurt();
      this.shake = Math.max(this.shake, 2.5);
      this.flashHpBar();
      if (!this.hurtHintShown && this.tutStep < 0) {
        this.hurtHintShown = true;
        this.setHint('Benangmu digesek! <b>Gesek balik</b> lebih cepat, atau menjauh.', 3);
      }
    }
  },

  cutEnemy(e, c) {
    e.dead = true; e.removed = true; e.contact = null;
    this.combo = this.t - this.lastCutT < 4 ? this.combo + 1 : 1;
    this.lastCutT = this.t;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const pts = e.T.score * this.combo;
    this.addScore(pts);
    this.cuts++;

    FX.confetti(e.x, e.y, e.T.boss ? 60 : 26, [e.style.a, e.style.b, '#ffd166']);
    FX.ring(c.x, c.y, '#ffffff', 26);
    FX.spark(c.x, c.y, 22, '#ffd166', 320);
    FX.text(e.x, e.y - e.size - 16, (e.T.golden ? 'EMAS! +' : 'PUTUS! +') + pts, e.T.golden ? '#ffd166' : '#ffffff', e.T.boss ? 34 : 24);
    if (this.combo >= 2) {
      FX.text(e.x, e.y - e.size - 44, 'COMBO x' + this.combo, '#ffd166', 20);
      Sound.combo(this.combo);
      this.popCombo();
    }
    Sound.snap();
    this.shake = Math.max(this.shake, e.T.boss ? 14 : 6);

    const cut = { x: c.x, y: c.y, ib: c.ib };
    const upper = slicePolyline(e.pts, cut, 'end', e.T.boss ? 220 : 160, 12);
    const lower = slicePolyline(e.pts, cut, 'start', 2000, 18);
    const L = new LooseKite({ x: e.x, y: e.y, vx: e.bvx, angle: e.angle, size: e.size, style: e.style, tail: e.tail, T: e.T }, upper.points, upper.length, true);
    this.loose.push(L);
    this.remnants.push(new Remnant(lower.points, lower.length, { x: e.ax, y: e.ay }, 'rgba(255,255,255,0.7)', 1.2));

    e.person.mood = 'sad';
    e.person.leaveT = 2.2;
    FX.text(e.person.hand.x, e.person.hand.y - 22, 'Yah...', '#e8e2f4', 15, 1.6);
    const nk = e.T.boss ? 4 : randi(1, 3);
    for (let i = 0; i < nk; i++) this.kids.push(new Kid(L));
    if (this.tutStep === 2) this.setTut(3);
  },

  catchLoose(L) {
    L.caught = true; L.removed = true;
    const P = this.player;
    const bonus = L.big ? 500 : 50;
    const heal = L.big ? 40 : 12;
    P.hp = Math.min(P.maxHp, P.hp + heal);
    this.caught++;
    this.addScore(bonus);
    FX.text(L.x, L.y - 30, 'DAPAT! +' + bonus, '#7bd88f', 22);
    FX.text(L.x, L.y - 6, '+benang', '#b8f28a', 16);
    FX.confetti(L.x, L.y, 14, ['#7bd88f', '#ffffff', L.style.a]);
    FX.ring(L.x, L.y, '#7bd88f', 34);
    Sound.catchKite();
    if (this.tutStep === 3) this.setTut(4);
  },

  cutPlayer(c) {
    const P = this.player;
    P.alive = false; P.hp = 0;
    const cut = { x: c.x, y: c.y, ib: c.ia };
    const upper = slicePolyline(P.pts, cut, 'end', 160, 12);
    const lower = slicePolyline(P.pts, cut, 'start', 2000, 18);
    const L = new LooseKite({ x: P.x, y: P.y, vx: P.vx, angle: P.angle, size: P.size, style: P.style, tail: P.tail }, upper.points, upper.length, false);
    this.loose.push(L);
    this.remnants.push(new Remnant(lower.points, lower.length, { x: P.ax, y: P.ay }, 'rgba(255,255,255,0.9)', 1.6));
    for (let i = 0; i < 3; i++) this.kids.push(new Kid(L));
    this.playerMood = 'sad';
    Sound.snap();
    Sound.gameOver();
    Sound.setSaw(0);
    this.shake = 16;
    this.timeScale = 0.35;
    this.dyingT = 1.6;
    FX.text(P.x, P.y - 40, 'PUTUS!', '#ff5a5f', 36, 1.6);
    this.setHint(null);
  },

  gameOver() {
    this.state = 'over';
    this.timeScale = 1;
    const isBest = this.score > this.best;
    if (isBest) { this.best = this.score; Store.set('best', this.best); }
    this.showGameOver(isBest);
  },

  // ---------- Tutorial ----------
  setTut(step) {
    this.tutStep = step;
    this.tutT = 0;
    const touch = this.pointerMode === 'touch';
    const texts = [
      touch ? '<b>Geser jari</b> di mana saja untuk menerbangkan layanganmu' : 'Gerakkan <b>mouse</b> (atau tombol panah) untuk menerbangkan layanganmu',
      'Arahkan layanganmu supaya <b>benangmu menyilang</b> benang lawan',
      '<b>GESEK!</b> Goyang layanganmu maju-mundur cepat-cepat!',
      'Mantap! <b>Tangkap layangan putus</b> itu untuk menambah benang',
    ];
    if (step >= texts.length) {
      this.tutStep = -1;
      this.tutorial = false;
      Store.set('tutorialDone', true);
      this.setHint(null);
      return;
    }
    this.setHint(step === 1 ? null : texts[step]);
    this.tutTexts = texts;
  },

  updateTutorial(dt) {
    if (this.tutStep < 0) return;
    this.tutT += dt;
    const s = this.tutStep;
    if (s === 0 && this.player.moved > 700 && this.tutT > 2) this.setTut(1);
    else if (s === 1 && !this.hintVisible) {
      if (this.enemies.some((e) => e.state !== 'rise' && !e.dead)) this.setHint(this.tutTexts[1]);
    } else if (s === 3 && this.tutT > 5) this.setTut(4);
  },
};
