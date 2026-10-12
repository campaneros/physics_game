// Istogramma delle osservazioni con fondo atteso e, a scoperta fatta, segnale e picco.
import { tr } from '../engine.js';

const COLOR = { bg: '#0d1527', obs: '#38bdf8', bkg: '#f87171', sig: '#4ade80', axis: '#94a3c0', peak: '#64748b' };

export function drawHist(canvas, h, reveal) {
  const c = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  c.fillStyle = COLOR.bg;
  c.fillRect(0, 0, W, H);
  if (!h.ok) return;
  const n = h.observed.length;
  const tot = h.expB.map((b, i) => b + h.expS[i]);
  const max = Math.max(1, ...h.observed, ...tot) * 1.15;
  const bw = W / n;
  const y = (v) => H - 18 - (v / max) * (H - 28);
  c.fillStyle = COLOR.obs;
  h.observed.forEach((v, i) => c.fillRect(i * bw + 1, y(v), bw - 2, H - 18 - y(v)));
  const line = (arr, color) => {
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    arr.forEach((v, i) => (i ? c.lineTo((i + 0.5) * bw, y(v)) : c.moveTo(0.5 * bw, y(v))));
    c.stroke();
  };
  line(h.expB, COLOR.bkg);
  if (reveal.signal) line(tot, COLOR.sig);
  if (reveal.peak) {
    c.strokeStyle = COLOR.peak;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(W / 2, 4);
    c.lineTo(W / 2, H - 18);
    c.stroke();
    c.setLineDash([]);
  }
  c.fillStyle = COLOR.axis;
  c.font = '12px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(tr(reveal.peak ? 'hist.axis' : 'hist.axis.plain'), W / 2, H - 4);
}
