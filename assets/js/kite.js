'use strict';
// ================= Gambar layangan, ekor, dan benang =================

const PLAYER_STYLE = { a: '#e63946', b: '#ffffff', pat: 'hsplit', rim: '#ffd166', tail: '#ffd166' };
const HUNTER_STYLE = { a: '#22223b', b: '#e63946', pat: 'eye', tail: '#e63946' };
const BOSS_STYLE = { a: '#2b2d42', b: '#ef233c', pat: 'eye', rim: '#ffd166', tail: '#ef233c' };
const GOLD_STYLE = { a: '#ffc300', b: '#fff3b0', pat: 'ring', rim: '#fff8d6', tail: '#fff3b0', shine: true };
const ENEMY_STYLES = [
  { a: '#118ab2', b: '#ffffff', pat: 'ring', tail: '#ffffff' },
  { a: '#06d6a0', b: '#073b4c', pat: 'stripe', tail: '#073b4c' },
  { a: '#8338ec', b: '#ffbe0b', pat: 'diag', tail: '#ffbe0b' },
  { a: '#fb5607', b: '#ffffff', pat: 'cross', tail: '#ffffff' },
  { a: '#3a86ff', b: '#ff006e', pat: 'split', tail: '#ff006e' },
  { a: '#ffbe0b', b: '#3a0ca3', pat: 'cross', tail: '#3a0ca3' },
  { a: '#2a9d8f', b: '#e9c46a', pat: 'diag', tail: '#e9c46a' },
  { a: '#f72585', b: '#ffffff', pat: 'stripe', tail: '#ffffff' },
];

// shadowBlur tidak ikut skala transform, jadi dikalikan manual.
let BLUR_SCALE = 1;

function kitePath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -1.15 * s);
  ctx.lineTo(0.85 * s, -0.25 * s);
  ctx.lineTo(0, 1.05 * s);
  ctx.lineTo(-0.85 * s, -0.25 * s);
  ctx.closePath();
}

// Posisi ujung bawah layangan (tempat ekor menempel) dalam koordinat dunia.
function kiteTailPoint(x, y, angle, s) {
  return { x: x - Math.sin(angle) * 1.05 * s, y: y + Math.cos(angle) * 1.05 * s };
}

// k: { x, y, angle, size, style, glow, flash, alpha, t }
function drawKite(ctx, k) {
  const s = k.size;
  const st = k.style;
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.angle);
  if (k.alpha !== undefined) ctx.globalAlpha = k.alpha;

  if (k.glow) {
    ctx.shadowColor = k.glow;
    ctx.shadowBlur = (k.glowBlur || 16) * BLUR_SCALE;
  }
  kitePath(ctx, s);
  ctx.fillStyle = st.a;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // motif
  ctx.save();
  kitePath(ctx, s);
  ctx.clip();
  ctx.fillStyle = st.b;
  switch (st.pat) {
    case 'hsplit':
      ctx.fillRect(-s, -0.25 * s, 2 * s, 2 * s);
      break;
    case 'split':
      ctx.fillRect(0, -2 * s, 2 * s, 4 * s);
      break;
    case 'ring':
      ctx.beginPath(); ctx.arc(0, -0.12 * s, 0.4 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = st.a;
      ctx.beginPath(); ctx.arc(0, -0.12 * s, 0.2 * s, 0, TAU); ctx.fill();
      break;
    case 'stripe':
      for (let i = -4; i <= 4; i += 2) ctx.fillRect(-s, i * 0.21 * s, 2 * s, 0.21 * s);
      break;
    case 'diag':
      ctx.beginPath(); ctx.moveTo(-s, -1.3 * s); ctx.lineTo(s, 1.2 * s); ctx.lineTo(-s, 1.2 * s); ctx.fill();
      break;
    case 'cross':
      ctx.fillRect(-0.13 * s, -2 * s, 0.26 * s, 4 * s);
      ctx.fillRect(-2 * s, -0.38 * s, 4 * s, 0.26 * s);
      break;
    case 'eye': {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, -0.16 * s, 0.46 * s, 0.26 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = st.b;
      ctx.beginPath(); ctx.arc(0, -0.16 * s, 0.19 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, -0.16 * s, 0.09 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = st.b;
      ctx.fillRect(-s, 0.45 * s, 2 * s, 0.14 * s);
      break;
    }
  }
  if (st.shine) {
    const ph = ((k.t || 0) * 0.8) % 2;
    const g = ctx.createLinearGradient(-s + ph * 2 * s - s, -s, ph * 2 * s - s + s * 0.2, s);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-s, -1.3 * s, 2 * s, 2.6 * s);
  }
  ctx.restore();

  // rangka bambu
  ctx.strokeStyle = 'rgba(60,36,12,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -1.15 * s); ctx.lineTo(0, 1.05 * s);
  ctx.moveTo(-0.85 * s, -0.25 * s);
  ctx.quadraticCurveTo(0, -0.5 * s, 0.85 * s, -0.25 * s);
  ctx.stroke();

  // tepi
  kitePath(ctx, s);
  ctx.strokeStyle = st.rim || 'rgba(0,0,0,0.35)';
  ctx.lineWidth = st.rim ? Math.max(2, s * 0.09) : Math.max(1, s * 0.05);
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (k.flash > 0) {
    kitePath(ctx, s);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k.flash)})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawTail(ctx, rope, size, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  rope.path(ctx);
  ctx.stroke();
  // pita kecil di sepanjang ekor
  ctx.fillStyle = color;
  const bw = size * 0.22;
  for (let i = 3; i < rope.n; i += 3) {
    const x = rope.x[i], y = rope.y[i];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - bw, y - bw * 0.6);
    ctx.lineTo(x - bw, y + bw * 0.6);
    ctx.closePath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bw, y - bw * 0.6);
    ctx.lineTo(x + bw, y + bw * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function strokePoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

function drawString(ctx, pts, color, width, glow) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = width * 3.2;
    strokePoly(ctx, pts);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  strokePoly(ctx, pts);
  ctx.restore();
}
