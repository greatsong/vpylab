import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import Header from '../../components/layout/Header';
import StepIndicator, { useStepProgress, StepTransition } from '../../components/shared/StepIndicator';
import { PlayIcon, PauseIcon, ResetIcon, TrainIcon } from '../../components/shared/Icons';
import { setupHiDPICanvas, getCSSColor } from '../../utils/canvasHiDPI';

/* ────────── 상수 ────────── */
const XOR_DATA = [
  { x1: 0, x2: 0, y: 0 },
  { x1: 0, x2: 1, y: 1 },
  { x1: 1, x2: 0, y: 1 },
  { x1: 1, x2: 1, y: 0 },
];
const XOR_X = [[0, 0], [0, 1], [1, 0], [1, 1]];
const XOR_Y = [[0], [1], [1], [0]];
const GRID_RES = 50;
const MAX_LOSS_POINTS = 200;

const STEPS = [
  { title: 'XOR 퍼즐' },
  { title: '뉴런 한 개로는?' },
  { title: '은닉층의 마법' },
  { title: '내가 조절하는 학습' },
];

/* ────────── 색상 보간 ────────── */
function lerpColor(t) {
  const r = Math.round(124 + (250 - 124) * t);
  const g = Math.round(58 + (204 - 58) * t);
  const b = Math.round(237 + (21 - 237) * t);
  return `rgb(${r},${g},${b})`;
}

function activationColor(val, accent = [74, 108, 247]) {
  const base = [40, 40, 50];
  const r = Math.round(base[0] + (accent[0] - base[0]) * val);
  const g = Math.round(base[1] + (accent[1] - base[1]) * val);
  const b = Math.round(base[2] + (accent[2] - base[2]) * val);
  return `rgb(${r},${g},${b})`;
}

/* ────────── 모델 생성 ────────── */
function createPerceptronModel(lr) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    inputShape: [2],
    kernelInitializer: 'glorotUniform',
  }));
  model.compile({
    optimizer: tf.train.sgd(lr),
    loss: 'meanSquaredError',
  });
  return model;
}

function createFullModel(lr) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    units: 4,
    activation: 'sigmoid',
    inputShape: [2],
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
  }));
  model.compile({
    optimizer: tf.train.sgd(lr),
    loss: 'meanSquaredError',
  });
  return model;
}

/* ────────── 가중치/활성값 추출 ────────── */
function extractWeights(model) {
  const weights = model.getWeights();
  if (weights.length === 2) {
    // Perceptron: w1[2,1], b1[1]
    return { w1: weights[0].arraySync(), b1: weights[1].arraySync(), w2: null, b2: null };
  }
  return {
    w1: weights[0].arraySync(), // [2,4]
    b1: weights[1].arraySync(), // [4]
    w2: weights[2].arraySync(), // [4,1]
    b2: weights[3].arraySync(), // [1]
  };
}

function getActivations(model, inputs) {
  return tf.tidy(() => {
    const x = tf.tensor2d(inputs);
    if (model.layers.length === 1) {
      const out = model.layers[0].apply(x);
      return { hidden: null, output: out.arraySync() };
    }
    const hiddenOut = model.layers[0].apply(x);
    const outputOut = model.layers[1].apply(hiddenOut);
    return { hidden: hiddenOut.arraySync(), output: outputOut.arraySync() };
  });
}

/* ────────── decision boundary 예측 ────────── */
function predictGrid(model) {
  return tf.tidy(() => {
    const points = [];
    for (let j = 0; j < GRID_RES; j++) {
      for (let i = 0; i < GRID_RES; i++) {
        points.push([i / (GRID_RES - 1), j / (GRID_RES - 1)]);
      }
    }
    const input = tf.tensor2d(points);
    const preds = model.predict(input);
    return preds.dataSync();
  });
}

/* ────────── 네트워크 다이어그램 그리기 ────────── */
const NEURON_R = 18;

function drawNeuron(ctx, x, y, activation, accentRGB) {
  const clampedAct = Math.max(0, Math.min(1, activation));

  if (clampedAct > 0.3) {
    const gradient = ctx.createRadialGradient(x, y, NEURON_R * 0.5, x, y, NEURON_R * 2);
    gradient.addColorStop(0, `rgba(${accentRGB[0]},${accentRGB[1]},${accentRGB[2]},${clampedAct * 0.3})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, NEURON_R * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = activationColor(clampedAct, accentRGB);
  ctx.strokeStyle = `rgba(${accentRGB[0]},${accentRGB[1]},${accentRGB[2]},0.6)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, NEURON_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = clampedAct > 0.5 ? '#1E293B' : '#E2E8F0';
  ctx.font = '600 10px var(--font-mono, JetBrains Mono, monospace)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(clampedAct.toFixed(2), x, y);
  ctx.textBaseline = 'alphabetic';
}

function drawPerceptronDiagram(canvas, model) {
  if (!canvas || !model) return;
  const W = 300, H = 240;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const inputX = 60, outputX = 240;
  const inputY = [80, 160];
  const outputY = [120];
  const { w1 } = extractWeights(model);
  const acts = getActivations(model, XOR_X);

  // 레이어 라벨
  ctx.font = '600 12px var(--font-display, Satoshi, sans-serif)';
  ctx.textAlign = 'center';
  ctx.fillStyle = getCSSColor('--color-text-secondary', '#94A3B8');
  ctx.fillText('입력', inputX, 36);
  ctx.fillText('출력', outputX, 36);

  // 입력 라벨
  ctx.font = '500 11px var(--font-mono, JetBrains Mono, monospace)';
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.fillText('x\u2081', inputX, inputY[0] + NEURON_R + 16);
  ctx.fillText('x\u2082', inputX, inputY[1] + NEURON_R + 16);

  // 연결선: 입력 -> 출력
  for (let i = 0; i < 2; i++) {
    const w = w1[i][0];
    const absW = Math.min(Math.abs(w), 2);
    const lineWidth = Math.max(0.5, absW * 2.5);
    const opacity = Math.min(0.9, 0.15 + absW * 0.35);
    ctx.strokeStyle = w > 0
      ? `rgba(74, 108, 247, ${opacity})`
      : `rgba(255, 107, 107, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(inputX + NEURON_R, inputY[i]);
    ctx.lineTo(outputX - NEURON_R, outputY[0]);
    ctx.stroke();
  }

  // 뉴런
  for (let i = 0; i < 2; i++) {
    drawNeuron(ctx, inputX, inputY[i], 0.5, [74, 108, 247]);
  }
  const avgOut = acts.output.reduce((s, r) => s + r[0], 0) / 4;
  drawNeuron(ctx, outputX, outputY[0], avgOut, [250, 204, 21]);

  // "은닉층 없음" 표시
  ctx.font = '500 11px var(--font-display, Satoshi, sans-serif)';
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.textAlign = 'center';
  ctx.fillText('은닉층 없음', (inputX + outputX) / 2, H - 12);
}

function drawFullNetworkDiagram(canvas, model) {
  if (!canvas || !model) return;
  const W = 400, H = 340;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const layerX = [70, 200, 330];
  const inputY = [120, 220];
  const hiddenY = [70, 140, 210, 280];
  const outputY = [170];

  const { w1, w2 } = extractWeights(model);
  const acts = getActivations(model, XOR_X);

  // 레이어 라벨
  ctx.font = '600 12px var(--font-display, Satoshi, sans-serif)';
  ctx.textAlign = 'center';
  ctx.fillStyle = getCSSColor('--color-text-secondary', '#94A3B8');
  ctx.fillText('입력', layerX[0], 30);
  ctx.fillText('은닉', layerX[1], 30);
  ctx.fillText('출력', layerX[2], 30);

  ctx.font = '500 11px var(--font-mono, JetBrains Mono, monospace)';
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.fillText('x\u2081', layerX[0], inputY[0] + NEURON_R + 16);
  ctx.fillText('x\u2082', layerX[0], inputY[1] + NEURON_R + 16);

  // 입력 -> 은닉
  for (let i = 0; i < 2; i++) {
    for (let h = 0; h < 4; h++) {
      const w = w1[i][h];
      const absW = Math.min(Math.abs(w), 2);
      const lineWidth = Math.max(0.5, absW * 2.5);
      const opacity = Math.min(0.9, 0.15 + absW * 0.35);
      ctx.strokeStyle = w > 0
        ? `rgba(74, 108, 247, ${opacity})`
        : `rgba(255, 107, 107, ${opacity})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(layerX[0] + NEURON_R, inputY[i]);
      ctx.lineTo(layerX[1] - NEURON_R, hiddenY[h]);
      ctx.stroke();
    }
  }

  // 은닉 -> 출력
  for (let h = 0; h < 4; h++) {
    const w = w2[h][0];
    const absW = Math.min(Math.abs(w), 2);
    const lineWidth = Math.max(0.5, absW * 2.5);
    const opacity = Math.min(0.9, 0.15 + absW * 0.35);
    ctx.strokeStyle = w > 0
      ? `rgba(74, 108, 247, ${opacity})`
      : `rgba(255, 107, 107, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(layerX[1] + NEURON_R, hiddenY[h]);
    ctx.lineTo(layerX[2] - NEURON_R, outputY[0]);
    ctx.stroke();
  }

  // 뉴런
  for (let i = 0; i < 2; i++) {
    drawNeuron(ctx, layerX[0], inputY[i], 0.5, [74, 108, 247]);
  }
  for (let h = 0; h < 4; h++) {
    const avgAct = acts.hidden.reduce((s, r) => s + r[h], 0) / 4;
    drawNeuron(ctx, layerX[1], hiddenY[h], avgAct, [74, 108, 247]);
  }
  const avgOut = acts.output.reduce((s, r) => s + r[0], 0) / 4;
  drawNeuron(ctx, layerX[2], outputY[0], avgOut, [250, 204, 21]);

  // 범례
  const legendY = H - 8;
  ctx.font = '400 10px var(--font-display, Satoshi, sans-serif)';
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.textAlign = 'left';

  ctx.fillStyle = '#4A6CF7';
  ctx.fillRect(30, legendY - 6, 14, 3);
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.fillText('양수', 48, legendY);

  ctx.fillStyle = '#FF6B6B';
  ctx.fillRect(90, legendY - 6, 14, 3);
  ctx.fillStyle = getCSSColor('--color-text-muted', '#64748B');
  ctx.fillText('음수', 108, legendY);
}

/* ────────── Decision Boundary ────────── */
function drawDecisionBoundary(canvas, model) {
  if (!canvas || !model) return;
  const W = 280, H = 280;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const preds = predictGrid(model);
  const cellW = W / GRID_RES;
  const cellH = H / GRID_RES;

  for (let j = 0; j < GRID_RES; j++) {
    for (let i = 0; i < GRID_RES; i++) {
      const val = preds[j * GRID_RES + i];
      ctx.fillStyle = lerpColor(val);
      ctx.fillRect(i * cellW, (GRID_RES - 1 - j) * cellH, cellW + 0.5, cellH + 0.5);
    }
  }

  // 축 라벨
  ctx.font = '500 11px var(--font-mono, JetBrains Mono, monospace)';
  ctx.fillStyle = '#E2E8F0';
  ctx.textAlign = 'center';
  ctx.fillText('x\u2081', W / 2, H - 4);
  ctx.save();
  ctx.translate(12, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('x\u2082', 0, 0);
  ctx.restore();

  // 눈금
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '400 9px var(--font-mono, JetBrains Mono, monospace)';
  ctx.textAlign = 'center';
  ctx.fillText('0', 6, H - 14);
  ctx.fillText('1', W - 6, H - 14);
  ctx.fillText('1', 18, 14);

  // XOR 데이터 포인트
  for (const d of XOR_DATA) {
    const px = d.x1 * (W - 40) + 20;
    const py = (1 - d.x2) * (H - 40) + 20;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = d.y === 1 ? '#FACC15' : '#7C3AED';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = d.y === 1 ? '#1E293B' : '#FFFFFF';
    ctx.font = '700 10px var(--font-mono, JetBrains Mono, monospace)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.y.toString(), px, py);
    ctx.textBaseline = 'alphabetic';
  }
}

/* ────────── Loss Chart ────────── */
function drawLossChart(canvas, history) {
  if (!canvas) return;
  const W = 280, H = 150;
  const ctx = setupHiDPICanvas(canvas, W, H);
  ctx.clearRect(0, 0, W, H);

  const borderColor = getCSSColor('--color-border', 'rgba(148,163,184,0.15)');
  const mutedColor = getCSSColor('--color-text-muted', '#64748B');

  // 배경 그리드
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (H - 30) * i / 4;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W - 10, y);
    ctx.stroke();
  }

  // Y축 라벨
  ctx.font = '400 9px var(--font-mono, JetBrains Mono, monospace)';
  ctx.fillStyle = mutedColor;
  ctx.textAlign = 'right';
  const maxLoss = history.length > 0 ? Math.max(0.3, Math.max(...history)) : 0.3;
  for (let i = 0; i <= 4; i++) {
    const val = maxLoss * (1 - i / 4);
    const y = 10 + (H - 30) * i / 4;
    ctx.fillText(val.toFixed(2), 36, y + 3);
  }

  // X축 라벨
  ctx.textAlign = 'center';
  ctx.fillText('에폭', W / 2, H - 2);

  if (history.length < 2) {
    ctx.fillStyle = mutedColor;
    ctx.font = '500 11px var(--font-display, Satoshi, sans-serif)';
    ctx.textAlign = 'center';
    ctx.fillText('학습을 시작하면 그래프가 나타납니다', W / 2, H / 2);
    return;
  }

  const plotW = W - 50, plotH = H - 30, plotX = 40, plotY = 10;
  const accentColor = getCSSColor('--color-accent', '#4A6CF7');

  ctx.beginPath();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  const gradientPath = new Path2D();
  for (let i = 0; i < history.length; i++) {
    const x = plotX + (i / (history.length - 1)) * plotW;
    const y = plotY + (1 - history[i] / maxLoss) * plotH;
    if (i === 0) { ctx.moveTo(x, y); gradientPath.moveTo(x, y); }
    else { ctx.lineTo(x, y); gradientPath.lineTo(x, y); }
  }
  ctx.stroke();

  gradientPath.lineTo(plotX + plotW, plotY + plotH);
  gradientPath.lineTo(plotX, plotY + plotH);
  gradientPath.closePath();

  const gradient = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
  gradient.addColorStop(0, 'rgba(74, 108, 247, 0.2)');
  gradient.addColorStop(1, 'rgba(74, 108, 247, 0.02)');
  ctx.fillStyle = gradient;
  ctx.fill(gradientPath);
}


/* ════════════════════════════════════════════════════════════════
   Step 1: XOR 퍼즐
   ════════════════════════════════════════════════════════════════ */
function Step1_XORPuzzle({ onComplete }) {
  const [visited, setVisited] = useState(new Set());
  const [flipped, setFlipped] = useState(null); // 현재 뒤집힌 카드 인덱스

  const handleClick = useCallback((idx) => {
    setFlipped(idx);
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

  // 모두 방문 시 완료
  useEffect(() => {
    if (visited.size === 4) {
      const timer = setTimeout(() => onComplete(), 800);
      return () => clearTimeout(timer);
    }
  }, [visited, onComplete]);

  const cardColors = ['#7C3AED', '#FACC15', '#FACC15', '#7C3AED'];
  const cardTextColors = ['#FFFFFF', '#1E293B', '#1E293B', '#FFFFFF'];

  return (
    <div>
      <p
        className="text-sm mb-5 leading-relaxed"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        4가지 경우를 모두 확인해보세요. 어떤 규칙일까요?
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-5">
        {XOR_DATA.map((d, idx) => {
          const isFlipped = flipped === idx;
          const isVisited = visited.has(idx);
          return (
            <button
              key={idx}
              onClick={() => handleClick(idx)}
              className="relative rounded-xl p-5 text-center transition-all duration-300 active:scale-95"
              style={{
                background: isFlipped
                  ? cardColors[idx]
                  : 'var(--color-bg-panel)',
                border: isVisited
                  ? `2px solid ${cardColors[idx]}`
                  : '2px solid var(--color-border)',
                cursor: 'pointer',
                minHeight: 100,
                transform: isFlipped ? 'scale(1.03)' : 'scale(1)',
                boxShadow: isFlipped ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {/* 입력값 */}
              <div
                className="text-xs font-medium mb-2"
                style={{
                  color: isFlipped ? cardTextColors[idx] : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-mono)',
                  opacity: 0.8,
                }}
              >
                x&#x2081;={d.x1}, x&#x2082;={d.x2}
              </div>
              {/* 결과 */}
              <div
                className="text-3xl font-bold"
                style={{
                  color: isFlipped
                    ? cardTextColors[idx]
                    : isVisited
                      ? cardColors[idx]
                      : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-display)',
                  opacity: isFlipped || isVisited ? 1 : 0.3,
                }}
              >
                {isFlipped || isVisited ? d.y : '?'}
              </div>
              {/* 방문 체크 */}
              {isVisited && !isFlipped && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--color-success)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 진행 상태 */}
      <div className="text-center">
        <span
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={{
            color: visited.size === 4 ? 'var(--color-success)' : 'var(--color-text-muted)',
            background: visited.size === 4 ? 'rgba(0,184,148,0.1)' : 'var(--color-bg-tertiary)',
          }}
        >
          {visited.size} / 4 확인 완료
        </span>
      </div>

      {visited.size === 4 && (
        <div
          className="mt-4 p-4 rounded-xl text-center"
          style={{
            background: 'rgba(0,184,148,0.08)',
            border: '1px solid rgba(0,184,148,0.2)',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
            XOR: 두 입력이 다를 때 1, 같을 때 0!
          </p>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   Step 2: 뉴런 한 개로는?
   ════════════════════════════════════════════════════════════════ */
function Step2_Perceptron({ onComplete }) {
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [failMessage, setFailMessage] = useState(false);

  const modelRef = useRef(null);
  const xsRef = useRef(null);
  const ysRef = useRef(null);
  const trainingRef = useRef(false);
  const mountedRef = useRef(true);
  const epochRef = useRef(0);
  const lossHistoryRef = useRef([]);

  const netCanvasRef = useRef(null);
  const dbCanvasRef = useRef(null);
  const lossCanvasRef = useRef(null);

  const initModel = useCallback(async () => {
    try { await tf.ready(); } catch { await tf.setBackend('cpu'); }
    if (!mountedRef.current) return;

    if (modelRef.current) modelRef.current.dispose();
    if (xsRef.current) { xsRef.current.dispose(); xsRef.current = null; }
    if (ysRef.current) { ysRef.current.dispose(); ysRef.current = null; }

    const model = createPerceptronModel(0.5);
    modelRef.current = model;
    xsRef.current = tf.tensor2d(XOR_X);
    ysRef.current = tf.tensor2d(XOR_Y);
    epochRef.current = 0;
    lossHistoryRef.current = [];

    setEpoch(0);
    setLoss(null);
    setIsTraining(false);
    setFailMessage(false);
    trainingRef.current = false;

    drawPerceptronDiagram(netCanvasRef.current, model);
    drawDecisionBoundary(dbCanvasRef.current, model);
    drawLossChart(lossCanvasRef.current, []);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initModel();
    return () => {
      mountedRef.current = false;
      trainingRef.current = false;
      if (modelRef.current) modelRef.current.dispose();
      if (xsRef.current) xsRef.current.dispose();
      if (ysRef.current) ysRef.current.dispose();
    };
  }, [initModel]);

  const startTraining = useCallback(async () => {
    if (trainingRef.current || !modelRef.current) return;
    trainingRef.current = true;
    setIsTraining(true);

    const model = modelRef.current;
    const xs = xsRef.current;
    const ys = ysRef.current;
    const targetEpochs = 200;

    while (trainingRef.current && mountedRef.current && epochRef.current < targetEpochs) {
      const result = await model.fit(xs, ys, { epochs: 1 });
      const currentLoss = result.history.loss[0];

      epochRef.current += 1;
      lossHistoryRef.current.push(currentLoss);
      if (lossHistoryRef.current.length > MAX_LOSS_POINTS) {
        lossHistoryRef.current = lossHistoryRef.current.slice(-MAX_LOSS_POINTS);
      }

      if (mountedRef.current) {
        setEpoch(epochRef.current);
        setLoss(currentLoss);
        drawPerceptronDiagram(netCanvasRef.current, model);
        drawDecisionBoundary(dbCanvasRef.current, model);
        drawLossChart(lossCanvasRef.current, [...lossHistoryRef.current]);
      }

      await new Promise((r) => setTimeout(r, 30));
    }

    if (mountedRef.current) {
      trainingRef.current = false;
      setIsTraining(false);
      // 200 에폭 후 loss > 0.15면 실패 메시지 + 완료
      if (epochRef.current >= targetEpochs) {
        const finalLoss = lossHistoryRef.current[lossHistoryRef.current.length - 1];
        if (finalLoss > 0.15) {
          setFailMessage(true);
          setTimeout(() => onComplete(), 1500);
        }
      }
    }
  }, [onComplete]);

  return (
    <div>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        뉴런 한 개(은닉층 없음)로 XOR을 풀 수 있을까요? 학습 버튼을 눌러 확인해보세요.
      </p>

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* 네트워크 다이어그램 */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
            퍼셉트론 (뉴런 1개)
          </h3>
          <canvas ref={netCanvasRef} style={{ width: 300, height: 240, borderRadius: 8 }} />
        </div>

        <div className="flex flex-col gap-4 flex-1 min-w-0">
          {/* Decision Boundary */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              결정 경계
            </h3>
            <canvas ref={dbCanvasRef} style={{ width: 280, height: 280, borderRadius: 8 }} />
          </div>

          {/* Loss */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              손실 (Loss)
            </h3>
            <canvas ref={lossCanvasRef} style={{ width: 280, height: 150, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      {/* 상태 + 버튼 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>에폭</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {epoch} / 200
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Loss</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {loss !== null ? loss.toFixed(4) : '\u2014'}
          </span>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {!isTraining ? (
          <button
            onClick={startTraining}
            disabled={epoch >= 200}
            className="btn-primary inline-flex items-center gap-2"
          >
            <TrainIcon size={14} />
            {epoch > 0 ? '학습 계속' : '학습 시작'}
          </button>
        ) : (
          <button
            onClick={() => { trainingRef.current = false; setIsTraining(false); }}
            className="btn-primary inline-flex items-center gap-2"
            style={{ background: 'var(--color-error)' }}
          >
            <PauseIcon size={14} />
            일시정지
          </button>
        )}
        <button
          onClick={initModel}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ResetIcon size={14} />
          초기화
        </button>
      </div>

      {failMessage && (
        <div
          className="p-4 rounded-xl text-center"
          style={{
            background: 'rgba(255,107,107,0.08)',
            border: '1px solid rgba(255,107,107,0.2)',
            animation: 'slide-up 0.3s ease-out',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#FF6B6B' }}>
            하나의 뉴런으로는 XOR 문제를 풀 수 없어요!
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            직선 하나로는 XOR 데이터를 분리할 수 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   Step 3: 은닉층의 마법
   ════════════════════════════════════════════════════════════════ */
function Step3_HiddenLayer({ onComplete }) {
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const modelRef = useRef(null);
  const xsRef = useRef(null);
  const ysRef = useRef(null);
  const trainingRef = useRef(false);
  const mountedRef = useRef(true);
  const epochRef = useRef(0);
  const lossHistoryRef = useRef([]);
  const completedRef = useRef(false);

  const netCanvasRef = useRef(null);
  const dbCanvasRef = useRef(null);
  const lossCanvasRef = useRef(null);

  const initModel = useCallback(async () => {
    try { await tf.ready(); } catch { await tf.setBackend('cpu'); }
    if (!mountedRef.current) return;

    if (modelRef.current) modelRef.current.dispose();
    if (xsRef.current) { xsRef.current.dispose(); xsRef.current = null; }
    if (ysRef.current) { ysRef.current.dispose(); ysRef.current = null; }

    const model = createFullModel(0.5);
    modelRef.current = model;
    xsRef.current = tf.tensor2d(XOR_X);
    ysRef.current = tf.tensor2d(XOR_Y);
    epochRef.current = 0;
    lossHistoryRef.current = [];
    completedRef.current = false;

    setEpoch(0);
    setLoss(null);
    setIsTraining(false);
    setSuccessMessage(false);
    trainingRef.current = false;

    drawFullNetworkDiagram(netCanvasRef.current, model);
    drawDecisionBoundary(dbCanvasRef.current, model);
    drawLossChart(lossCanvasRef.current, []);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initModel();
    return () => {
      mountedRef.current = false;
      trainingRef.current = false;
      if (modelRef.current) modelRef.current.dispose();
      if (xsRef.current) xsRef.current.dispose();
      if (ysRef.current) ysRef.current.dispose();
    };
  }, [initModel]);

  const startTraining = useCallback(async () => {
    if (trainingRef.current || !modelRef.current) return;
    trainingRef.current = true;
    setIsTraining(true);

    const model = modelRef.current;
    const xs = xsRef.current;
    const ys = ysRef.current;

    while (trainingRef.current && mountedRef.current && epochRef.current < 500) {
      const result = await model.fit(xs, ys, { epochs: 1 });
      const currentLoss = result.history.loss[0];

      epochRef.current += 1;
      lossHistoryRef.current.push(currentLoss);
      if (lossHistoryRef.current.length > MAX_LOSS_POINTS) {
        lossHistoryRef.current = lossHistoryRef.current.slice(-MAX_LOSS_POINTS);
      }

      if (mountedRef.current) {
        setEpoch(epochRef.current);
        setLoss(currentLoss);
        drawFullNetworkDiagram(netCanvasRef.current, model);
        drawDecisionBoundary(dbCanvasRef.current, model);
        drawLossChart(lossCanvasRef.current, [...lossHistoryRef.current]);

        // loss < 0.05 이면 성공
        if (currentLoss < 0.05 && !completedRef.current) {
          completedRef.current = true;
          setSuccessMessage(true);
          trainingRef.current = false;
          setIsTraining(false);
          setTimeout(() => onComplete(), 1500);
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 30));
    }

    if (mountedRef.current) {
      trainingRef.current = false;
      setIsTraining(false);
    }
  }, [onComplete]);

  return (
    <div>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        이번에는 은닉층(뉴런 4개)을 추가한 네트워크입니다. 학습 버튼을 눌러보세요!
      </p>

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* 네트워크 다이어그램 */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
            2 - 4 - 1 네트워크
          </h3>
          <canvas ref={netCanvasRef} style={{ width: 400, height: 340, borderRadius: 8 }} />
        </div>

        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              결정 경계
            </h3>
            <canvas ref={dbCanvasRef} style={{ width: 280, height: 280, borderRadius: 8 }} />
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#7C3AED', borderRadius: '50%' }} />
                출력 = 0
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FACC15', borderRadius: '50%' }} />
                출력 = 1
              </span>
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              손실 (Loss)
            </h3>
            <canvas ref={lossCanvasRef} style={{ width: 280, height: 150, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      {/* 상태 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>에폭</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {epoch}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Loss</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: loss !== null && loss < 0.05 ? 'var(--color-success)' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {loss !== null ? loss.toFixed(4) : '\u2014'}
          </span>
        </div>
        {isTraining && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: 'var(--color-accent)', background: 'rgba(74,108,247,0.12)' }}
          >
            학습 중...
          </span>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        {!isTraining ? (
          <button
            onClick={startTraining}
            disabled={successMessage}
            className="btn-primary inline-flex items-center gap-2"
          >
            <TrainIcon size={14} />
            {epoch > 0 ? '학습 계속' : '학습 시작'}
          </button>
        ) : (
          <button
            onClick={() => { trainingRef.current = false; setIsTraining(false); }}
            className="btn-primary inline-flex items-center gap-2"
            style={{ background: 'var(--color-error)' }}
          >
            <PauseIcon size={14} />
            일시정지
          </button>
        )}
        <button
          onClick={initModel}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ResetIcon size={14} />
          초기화
        </button>
      </div>

      {successMessage && (
        <div
          className="p-4 rounded-xl text-center"
          style={{
            background: 'rgba(0,184,148,0.08)',
            border: '1px solid rgba(0,184,148,0.2)',
            animation: 'slide-up 0.3s ease-out',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
            은닉층을 추가하니 해결되었어요!
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            비선형 결정 경계로 XOR 데이터를 올바르게 분류합니다.
          </p>
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   Step 4: 내가 조절하는 학습
   ════════════════════════════════════════════════════════════════ */
function Step4_FreePlay() {
  const [lr, setLr] = useState(0.5);
  const [speed, setSpeed] = useState(50);
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState(null);
  const [isTraining, setIsTraining] = useState(false);

  const modelRef = useRef(null);
  const xsRef = useRef(null);
  const ysRef = useRef(null);
  const trainingRef = useRef(false);
  const mountedRef = useRef(true);
  const epochRef = useRef(0);
  const lossHistoryRef = useRef([]);

  const netCanvasRef = useRef(null);
  const dbCanvasRef = useRef(null);
  const lossCanvasRef = useRef(null);

  const initModel = useCallback(async () => {
    try { await tf.ready(); } catch { await tf.setBackend('cpu'); }
    if (!mountedRef.current) return;

    if (modelRef.current) modelRef.current.dispose();
    if (xsRef.current) { xsRef.current.dispose(); xsRef.current = null; }
    if (ysRef.current) { ysRef.current.dispose(); ysRef.current = null; }

    const model = createFullModel(lr);
    modelRef.current = model;
    xsRef.current = tf.tensor2d(XOR_X);
    ysRef.current = tf.tensor2d(XOR_Y);
    epochRef.current = 0;
    lossHistoryRef.current = [];

    setEpoch(0);
    setLoss(null);
    setIsTraining(false);
    trainingRef.current = false;

    drawFullNetworkDiagram(netCanvasRef.current, model);
    drawDecisionBoundary(dbCanvasRef.current, model);
    drawLossChart(lossCanvasRef.current, []);
  }, [lr]);

  useEffect(() => {
    mountedRef.current = true;
    initModel();
    return () => {
      mountedRef.current = false;
      trainingRef.current = false;
      if (modelRef.current) modelRef.current.dispose();
      if (xsRef.current) xsRef.current.dispose();
      if (ysRef.current) ysRef.current.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTraining = useCallback(async () => {
    if (trainingRef.current || !modelRef.current) return;
    trainingRef.current = true;
    setIsTraining(true);

    const model = modelRef.current;
    const xs = xsRef.current;
    const ys = ysRef.current;

    while (trainingRef.current && mountedRef.current && epochRef.current < 1000) {
      const result = await model.fit(xs, ys, { epochs: 1 });
      const currentLoss = result.history.loss[0];

      epochRef.current += 1;
      lossHistoryRef.current.push(currentLoss);
      if (lossHistoryRef.current.length > MAX_LOSS_POINTS) {
        lossHistoryRef.current = lossHistoryRef.current.slice(-MAX_LOSS_POINTS);
      }

      if (mountedRef.current) {
        setEpoch(epochRef.current);
        setLoss(currentLoss);
        drawFullNetworkDiagram(netCanvasRef.current, model);
        drawDecisionBoundary(dbCanvasRef.current, model);
        drawLossChart(lossCanvasRef.current, [...lossHistoryRef.current]);
      }

      if (speed > 5) {
        await new Promise((r) => setTimeout(r, speed));
      } else {
        await new Promise((r) => requestAnimationFrame(r));
      }
    }

    if (mountedRef.current) {
      trainingRef.current = false;
      setIsTraining(false);
    }
  }, [speed]);

  const handleReset = useCallback(() => {
    trainingRef.current = false;
    setTimeout(() => initModel(), 100);
  }, [initModel]);

  const speedLabel = speed <= 10 ? '매우 빠름' : speed <= 50 ? '빠름' : speed <= 100 ? '보통' : '느림';

  return (
    <div>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        학습률과 속도를 자유롭게 조절하며 실험해보세요!
      </p>

      {/* 설명 카드 */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(74,108,247,0.06)', border: '1px solid rgba(74,108,247,0.15)' }}
      >
        <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>
          학습률이란?
        </h4>
        <ul className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          <li>학습률은 한 번에 가중치를 얼마나 크게 바꿀지 결정합니다.</li>
          <li>너무 작으면: 학습이 매우 느려집니다.</li>
          <li>너무 크면: 최적값을 지나쳐서 loss가 흔들리거나 발산합니다.</li>
          <li>적당한 값(0.3~0.7)을 찾아보세요!</li>
        </ul>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* 네트워크 */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
            네트워크 구조
          </h3>
          <canvas ref={netCanvasRef} style={{ width: 400, height: 340, borderRadius: 8 }} />
        </div>

        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              결정 경계
            </h3>
            <canvas ref={dbCanvasRef} style={{ width: 280, height: 280, borderRadius: 8 }} />
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#7C3AED', borderRadius: '50%' }} />
                출력 = 0
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#FACC15', borderRadius: '50%' }} />
                출력 = 1
              </span>
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-display)' }}>
              손실 (Loss)
            </h3>
            <canvas ref={lossCanvasRef} style={{ width: 280, height: 150, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      {/* 슬라이더 */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3 mb-4">
          <div className="flex items-center gap-3 min-w-[240px]">
            <label className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-muted)', minWidth: 40 }}>
              학습률
            </label>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
              disabled={isTraining}
              className="flex-1 accent-[var(--color-accent)]"
              style={{ height: 4 }}
            />
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', minWidth: 32 }}>
              {lr.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-[240px]">
            <label className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-muted)', minWidth: 40 }}>
              속도
            </label>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
              className="flex-1 accent-[var(--color-accent)]"
              style={{ height: 4 }}
            />
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)', minWidth: 52 }}>
              {speedLabel}
            </span>
          </div>
        </div>

        {/* 상태 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>에폭</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {epoch}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Loss</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{
                color: loss !== null && loss < 0.05 ? 'var(--color-success)' : 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {loss !== null ? loss.toFixed(4) : '\u2014'}
            </span>
          </div>
          {isTraining && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: 'var(--color-accent)', background: 'rgba(74,108,247,0.12)' }}
            >
              학습 중...
            </span>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          {!isTraining ? (
            <button
              onClick={startTraining}
              className="btn-primary inline-flex items-center gap-2"
            >
              <PlayIcon size={14} />
              {epoch > 0 ? '학습 계속' : '학습 시작'}
            </button>
          ) : (
            <button
              onClick={() => { trainingRef.current = false; setIsTraining(false); }}
              className="btn-primary inline-flex items-center gap-2"
              style={{ background: 'var(--color-error)' }}
            >
              <PauseIcon size={14} />
              일시정지
            </button>
          )}
          <button
            onClick={handleReset}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ResetIcon size={14} />
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   메인 NeuralNetViz 컴포넌트
   ════════════════════════════════════════════════════════════════ */
export default function NeuralNetViz() {
  const {
    currentStep,
    completedSteps,
    showTransition,
    completeStep,
    goToStep,
    dismissTransition,
    isUnlocked,
  } = useStepProgress(4);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Header />

      {/* 상단 네비 */}
      <div className="mx-auto px-4 pt-6 pb-2" style={{ maxWidth: 960 }}>
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/ai-lab"
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--color-accent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            AI 실험실
          </Link>
        </div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
        >
          뉴런이 살아 움직인다
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          XOR 문제를 통해 신경망이 왜 은닉층이 필요한지 단계별로 알아봅시다
        </p>

        {/* 스텝 표시기 */}
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="mx-auto px-4 pb-8" style={{ maxWidth: 960 }}>
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* 스텝 제목 */}
          <h2
            className="text-lg font-bold mb-4"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Step {currentStep}: {STEPS[currentStep - 1].title}
          </h2>

          {currentStep === 1 && (
            <Step1_XORPuzzle onComplete={() => completeStep(1)} />
          )}
          {currentStep === 2 && (
            <Step2_Perceptron onComplete={() => completeStep(2)} />
          )}
          {currentStep === 3 && (
            <Step3_HiddenLayer onComplete={() => completeStep(3)} />
          )}
          {currentStep === 4 && (
            <Step4_FreePlay />
          )}
        </div>
      </div>

      {/* 스텝 전환 오버레이 */}
      {showTransition && currentStep < 4 && (
        <StepTransition
          nextStepTitle={STEPS[currentStep].title}
          onNext={dismissTransition}
        />
      )}
    </div>
  );
}
