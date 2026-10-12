// Disegno su canvas del minigioco "La forma nascosta": lanci (cerchio pieno con freccia), uscite (anello numerato), mira e, a risposta data, la forma.
import { Core } from '../engine.js';

export const AIM_STUB = 0.16;
export const COLORS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#c084fc'];
const BG = '#0b1220';

export function pathPoly(c, pts, S, ox = 0, oy = 0) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(ox + x * S, oy + y * S) : c.moveTo(ox + x * S, oy + y * S)));
  c.closePath();
}

function dot(ctx, x, y, r, color, ring) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  if (ring) { ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
}

function label(ctx, n, x, y, S, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(S * 0.04)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x, y);
}

function drawLaunch(ctx, l, i, S) {
  const R = S * 0.034;
  const at = ([x, y]) => [Math.min(S - R, Math.max(R, x * S)), Math.min(S - R, Math.max(R, y * S))];
  const color = COLORS[i % COLORS.length];
  const [ix, iy] = at(l.entry);
  const [ox, oy] = at(l.exit);
  const [dx, dy] = l.dir;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(ox, oy);
  ctx.stroke();
  ctx.restore();
  dot(ctx, ix, iy, R, color, false);
  const k = R * 0.62;
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.moveTo(ix + dx * k, iy + dy * k);
  ctx.lineTo(ix - dx * k * 0.6 - dy * k * 0.7, iy - dy * k * 0.6 + dx * k * 0.7);
  ctx.lineTo(ix - dx * k * 0.6 + dy * k * 0.7, iy - dy * k * 0.6 - dx * k * 0.7);
  ctx.closePath();
  ctx.fill();
  dot(ctx, ox, oy, R, BG, false);
  dot(ctx, ox, oy, R, color, true);
  label(ctx, i + 1, ox, oy, S, color);
  label(ctx, i + 1, ix + dx * R * 2.1, iy + dy * R * 2.1, S, color);
}

function drawAim(ctx, aim, S) {
  const [ex, ey] = aim.entry.p;
  const dir = [aim.cur[0] - ex, aim.cur[1] - ey];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  ctx.strokeStyle = Core.isInward(dir, aim.entry.n) ? '#ffffff' : '#f87171';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ex * S, ey * S);
  ctx.lineTo((ex + (dir[0] / len) * AIM_STUB) * S, (ey + (dir[1] / len) * AIM_STUB) * S);
  ctx.stroke();
  dot(ctx, ex * S, ey * S, S * 0.022, ctx.strokeStyle, false);
}

/** Ridisegna tutto: sfondo, forma (solo a risposta data), lanci e mira. */
export function drawBoard(canvas, { poly, launches, phase, aim }) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);
  if (phase === 'done') {
    pathPoly(ctx, poly, S);
    ctx.fillStyle = 'rgba(56,189,248,0.25)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();
  }
  launches.forEach((l, i) => drawLaunch(ctx, l, i, S));
  if (aim) drawAim(ctx, aim, S);
}
