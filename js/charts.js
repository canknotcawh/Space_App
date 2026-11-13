/* =============================================================================
 * charts.js — Biểu đồ canvas nhẹ (không thư viện ngoài)
 *  - Donut phân bố địa hình
 *  - Biểu đồ 12 tháng: cột lượng mưa + đường nhiệt độ
 * ========================================================================== */

export const TERRAIN_COLORS = {
  mountain: '#FF8A00',
  hill: '#C6FF3D',
  plain: '#00E5FF',
  plateau: '#FF3CAC',
  desert: '#E7C08A',
  water: '#4C7CFF'
};

function fit(canvas) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width || canvas.width));
  const h = Math.max(1, Math.round(rect.height || canvas.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export function drawDonut(canvas, segments, centerLabel = '') {
  const fitted = fit(canvas);
  if (!fitted) return;
  const { ctx, w, h } = fitted;
  const cx = w / 2, cy = h / 2;
  const rOuter = Math.min(w, h) / 2 - 2;
  const rInner = rOuter * 0.62;
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  let angle = -Math.PI / 2;
  const gap = 0.025;
  segments.forEach((s) => {
    const val = Math.max(0, Number(s.value) || 0);
    if (val <= 0.001) return;
    const sweep = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, angle + gap / 2, angle + sweep - gap / 2);
    ctx.arc(cx, cy, rInner, angle + sweep - gap / 2, angle + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    angle += sweep;
  });
  // Vòng trong
  ctx.beginPath();
  ctx.arc(cx, cy, rInner - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (centerLabel) {
    ctx.fillStyle = '#98A3C7';
    ctx.font = '600 9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centerLabel.toUpperCase(), cx, cy - 5);
  }
}

const tColor = 'rgba(255,138,0,1)';
const pColor = 'rgba(0,229,255,.55)';

export function drawClimateChart(canvas, temps, precips, labels, highlightMonth = 0) {
  const fitted = fit(canvas);
  if (!fitted) return;
  const { ctx, w, h } = fitted;
  const pad = { l: 6, r: 6, t: 14, b: 20 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const pMax = Math.max(10, ...precips.map((v) => Number(v) || 0));
  const tVals = temps.map((v) => Number(v) || 0);
  let tMin = Math.min(...tVals);
  let tMax = Math.max(...tVals);
  if (tMax - tMin < 6) { tMax += 3; tMin -= 3; }
  const tPad = (tMax - tMin) * 0.15;
  tMin -= tPad; tMax += tPad;

  // Lưới ngang
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = pad.t + (plotH / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
  }

  const step = plotW / temps.length;
  const barW = Math.max(4, step * 0.44);

  // Dải sáng cho tháng đang được nghe
  if (highlightMonth >= 1 && highlightMonth <= temps.length) {
    const hx = pad.l + step * (highlightMonth - 1);
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    ctx.fillRect(hx, pad.t, step, plotH);
    ctx.strokeStyle = 'rgba(0,229,255,.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 0.5, pad.t + 0.5, step - 1, plotH - 1);
  }

  // Cột mưa
  precips.forEach((p, i) => {
    const v = Math.max(0, Number(p) || 0);
    const bh = (v / pMax) * plotH * 0.86;
    const x = pad.l + step * i + step / 2 - barW / 2;
    const y = pad.t + plotH - bh;
    const grad = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
    grad.addColorStop(0, 'rgba(0,229,255,.75)');
    grad.addColorStop(1, 'rgba(0,229,255,.08)');
    ctx.fillStyle = grad;
    const r = Math.min(4, barW / 2);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, [r, r, 0, 0]);
    else ctx.rect(x, y, barW, bh);
    ctx.fill();
  });

  // Đường nhiệt độ
  const points = tVals.map((v, i) => ({
    x: pad.l + step * i + step / 2,
    y: pad.t + plotH - ((v - tMin) / (tMax - tMin)) * plotH * 0.92 - plotH * 0.04
  }));
  const lineGrad = ctx.createLinearGradient(pad.l, 0, w - pad.r, 0);
  lineGrad.addColorStop(0, '#FFC24B');
  lineGrad.addColorStop(1, '#FF8A00');
  ctx.beginPath();
  points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,138,0,.4)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  points.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD8A0';
    ctx.fill();
  });

  // Nhãn tháng
  ctx.fillStyle = 'rgba(152,163,199,.9)';
  ctx.font = '9px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    if (i % 2 !== 0 && w < 240) return;
    ctx.fillText(label, pad.l + step * i + step / 2, h - 6);
  });
}

/** Vẽ waveform/analyser cho track. */
export function drawWaveform(canvas, data, accent, idle = false) {
  const fitted = fit(canvas);
  if (!fitted) return;
  const { ctx, w, h } = fitted;
  const mid = h / 2;
  if (idle || !data) {
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    return;
  }
  const n = data.length;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, 'rgba(255,255,255,.75)');
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const v = (data[i] - 128) / 128;
    const x = (i / (n - 1)) * w;
    const y = mid + v * (h / 2) * 0.9;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.lineTo(w, mid);
  ctx.lineTo(0, mid);
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.globalAlpha = 1;
}
