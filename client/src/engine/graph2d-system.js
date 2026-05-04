/**
 * VPyLab — 2D 그래프 시스템
 * Python에서 생성한 graph/gcurve/gdots/gvbars/ghbars를
 * 메인 스레드의 Canvas2D로 렌더링.
 *
 * 아키텍처:
 * - graph가 캔버스 1개를 만들고 패널에 부착
 * - 시리즈(gcurve 등)는 graph에 등록되어 같은 캔버스에 그려짐
 * - 각 plot 호출마다 누적된 점들을 자동 스케일링하여 다시 그림
 */

const graphRegistry = new Map();   // graphId → { canvas, ctx, opts, series:Map<seriesId, seriesObj> }
const seriesGraphMap = new Map();  // seriesId → graphId
let panelEl = null;

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.querySelector('[data-vpylab-graphs]');
  if (panelEl) return panelEl;
  panelEl = document.createElement('div');
  panelEl.setAttribute('data-vpylab-graphs', '');
  panelEl.style.cssText = [
    'position:absolute', 'left:8px', 'bottom:8px',
    'z-index:10',
    'display:flex', 'flex-direction:column', 'gap:8px',
    'pointer-events:none',
  ].join(';');
  const host = document.querySelector('[data-vpylab-viewport]') || document.body;
  const cs = host.nodeType === 1 ? getComputedStyle(host) : null;
  if (cs && cs.position === 'static' && host !== document.body) {
    host.style.position = 'relative';
  }
  host.appendChild(panelEl);
  return panelEl;
}

function removePanelIfEmpty() {
  if (panelEl && graphRegistry.size === 0) {
    panelEl.remove();
    panelEl = null;
  }
}

export function createGraph(cmd) {
  const panel = ensurePanel();
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'background:rgba(255,255,255,0.95)',
    'border-radius:8px',
    'padding:8px 10px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
    'pointer-events:auto',
    'font:12px/1.3 "DM Sans", "Noto Sans KR", sans-serif',
    'color:#222',
  ].join(';');

  if (cmd.title) {
    const t = document.createElement('div');
    t.textContent = String(cmd.title);
    t.style.cssText = 'font-weight:600;margin-bottom:4px;';
    wrap.appendChild(t);
  }

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cmd.width ?? 480;
  const h = cmd.height ?? 320;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  wrap.appendChild(canvas);

  if (cmd.xtitle || cmd.ytitle) {
    const ax = document.createElement('div');
    ax.style.cssText = 'display:flex;justify-content:space-between;color:#666;margin-top:2px;';
    const x = document.createElement('span');
    x.textContent = `x: ${cmd.xtitle || ''}`;
    const y = document.createElement('span');
    y.textContent = `y: ${cmd.ytitle || ''}`;
    ax.appendChild(x); ax.appendChild(y);
    wrap.appendChild(ax);
  }

  panel.appendChild(wrap);
  graphRegistry.set(cmd.id, {
    wrap, canvas, ctx,
    opts: { width: w, height: h, ...cmd },
    series: new Map(),
  });
}

export function deleteGraph(cmd) {
  const g = graphRegistry.get(cmd.id);
  if (!g) return;
  // 시리즈 매핑 정리
  for (const sid of g.series.keys()) seriesGraphMap.delete(sid);
  g.wrap.remove();
  graphRegistry.delete(cmd.id);
  removePanelIfEmpty();
}

export function createSeries(cmd) {
  const g = graphRegistry.get(cmd.graph_id);
  if (!g) return;
  g.series.set(cmd.id, {
    id: cmd.id,
    kind: cmd.kind,
    color: cmd.color || [0.2, 0.5, 0.9],
    width: cmd.width ?? 1.5,
    size: cmd.size ?? 4,
    label: cmd.label || '',
    visible: cmd.visible !== false,
    points: [],
  });
  seriesGraphMap.set(cmd.id, cmd.graph_id);
}

export function deleteSeries(cmd) {
  const gid = seriesGraphMap.get(cmd.id);
  if (!gid) return;
  const g = graphRegistry.get(gid);
  if (g) {
    g.series.delete(cmd.id);
    redraw(g);
  }
  seriesGraphMap.delete(cmd.id);
}

export function plotSeries(cmd) {
  const gid = seriesGraphMap.get(cmd.id);
  if (!gid) return;
  const g = graphRegistry.get(gid);
  if (!g) return;
  const s = g.series.get(cmd.id);
  if (!s) return;
  for (const pt of (cmd.points || [])) {
    s.points.push([pt[0], pt[1]]);
  }
  redraw(g);
}

function redraw(g) {
  const { ctx, opts, series } = g;
  const W = opts.width;
  const H = opts.height;

  // 배경 + 테두리
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // 모든 시리즈에서 점 수집
  let allPoints = [];
  for (const s of series.values()) {
    if (s.visible) allPoints = allPoints.concat(s.points);
  }
  if (allPoints.length === 0) return;

  // 자동 스케일 (사용자 지정 범위가 있으면 우선)
  let xmin = opts.xmin, xmax = opts.xmax, ymin = opts.ymin, ymax = opts.ymax;
  if (xmin === null || xmin === undefined) xmin = Math.min(...allPoints.map(p => p[0]));
  if (xmax === null || xmax === undefined) xmax = Math.max(...allPoints.map(p => p[0]));
  if (ymin === null || ymin === undefined) ymin = Math.min(...allPoints.map(p => p[1]));
  if (ymax === null || ymax === undefined) ymax = Math.max(...allPoints.map(p => p[1]));

  // 0폭 방지
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  if (ymin === ymax) { ymin -= 1; ymax += 1; }

  const pad = 28;
  const plotW = W - pad * 1.2;
  const plotH = H - pad * 1.2;
  const ox = pad;
  const oy = pad / 2;
  const tx = (x) => ox + ((x - xmin) / (xmax - xmin)) * plotW;
  const ty = (y) => oy + plotH - ((y - ymin) / (ymax - ymin)) * plotH;

  // 축
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + plotH);
  ctx.lineTo(ox + plotW, oy + plotH);
  ctx.stroke();

  // 눈금 라벨
  ctx.fillStyle = '#666';
  ctx.font = '10px "DM Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(ymax.toFixed(2), ox - 4, ty(ymax));
  ctx.fillText(ymin.toFixed(2), ox - 4, ty(ymin));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(xmin.toFixed(2), tx(xmin), oy + plotH + 3);
  ctx.fillText(xmax.toFixed(2), tx(xmax), oy + plotH + 3);

  // 시리즈 그리기
  for (const s of series.values()) {
    if (!s.visible || s.points.length === 0) continue;
    const [r, gg, b] = s.color;
    const stroke = `rgb(${Math.round(r*255)}, ${Math.round(gg*255)}, ${Math.round(b*255)})`;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;

    if (s.kind === 'curve') {
      ctx.lineWidth = s.width;
      ctx.beginPath();
      let started = false;
      for (const [x, y] of s.points) {
        const px = tx(x), py = ty(y);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (s.kind === 'dots') {
      const r2 = s.size / 2;
      for (const [x, y] of s.points) {
        ctx.beginPath();
        ctx.arc(tx(x), ty(y), r2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s.kind === 'vbars') {
      const baseline = ty(Math.max(0, ymin));
      const barW = Math.max(2, plotW / Math.max(s.points.length, 1) * 0.7);
      for (const [x, y] of s.points) {
        const px = tx(x), py = ty(y);
        ctx.fillRect(px - barW / 2, Math.min(py, baseline), barW, Math.abs(py - baseline));
      }
    } else if (s.kind === 'hbars') {
      const baseline = tx(Math.max(0, xmin));
      const barH = Math.max(2, plotH / Math.max(s.points.length, 1) * 0.7);
      for (const [x, y] of s.points) {
        const px = tx(x), py = ty(y);
        ctx.fillRect(Math.min(px, baseline), py - barH / 2, Math.abs(px - baseline), barH);
      }
    }
  }
}

export function clearGraphs2D() {
  for (const [, g] of graphRegistry) g.wrap.remove();
  graphRegistry.clear();
  seriesGraphMap.clear();
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
}
