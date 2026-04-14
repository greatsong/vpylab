import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import Header from '../../components/layout/Header';
import StepIndicator, { useStepProgress, StepTransition } from '../../components/shared/StepIndicator';
import {
  PlayIcon, PauseIcon, ResetIcon, StepForwardIcon, MapIcon,
  ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon,
} from '../../components/shared/Icons';
import { setupHiDPICanvas, getCSSColor } from '../../utils/canvasHiDPI';

/* ────────── 상수 ────────── */
const GRID_SIZE = 7;
const CELL_PX = 60;
const CANVAS_PX = GRID_SIZE * CELL_PX;
const CHART_W = CANVAS_PX;
const CHART_H = Math.round(CANVAS_PX * 0.7);
const ACTIONS = [
  [0, -1],  // 0: 위
  [1, 0],   // 1: 오른쪽
  [0, 1],   // 2: 아래
  [-1, 0],  // 3: 왼쪽
];
const ACTION_ARROWS = ['\u2191', '\u2192', '\u2193', '\u2190'];
const GOAL = [6, 6];
const START = [0, 0];
const REWARD_WALL_BUMP = -10;
const MAX_STEPS = 200;
const EPISODES_PER_FRAME = 10;

const STEP_DEFS = [
  { title: '\uD0D0\uD5D8\uAC00 \uB3C4\uC804' },
  { title: 'AI\uC5D0\uAC8C \uB9E1\uACA8\uBCFC\uAE4C?' },
  { title: '\uBCF4\uC0C1 \uC124\uACC4\uC0AC' },
  { title: '\uD558\uC774\uD37C\uD30C\uB77C\uBBF8\uD130 \uB9C8\uC2A4\uD130' },
];

/* ────────── Q-Table 헬퍼 ────────── */
function makeKey(r, c) {
  return `${r},${c}`;
}

function initQTable() {
  const q = new Map();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      q.set(makeKey(r, c), [0, 0, 0, 0]);
    }
  }
  return q;
}

function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[best]) best = i;
  }
  return best;
}

/* ────────── 그리드 월드 Canvas 렌더링 ────────── */
function drawGrid(ctx, walls, qTable, agentPos, path, showQValues) {
  const w = CANVAS_PX;
  const h = CANVAS_PX;
  ctx.clearRect(0, 0, w, h);

  const bgPanel = getCSSColor('--color-bg-panel', '#ffffff');
  const textMuted = getCSSColor('--color-text-muted', '#999');
  const borderColor = getCSSColor('--color-border', '#e0e0e0');

  // Q-value 최대/최소
  let qMin = 0, qMax = 0;
  if (showQValues) {
    qTable.forEach((vals) => {
      const mx = Math.max(...vals);
      if (mx > qMax) qMax = mx;
      if (mx < qMin) qMin = mx;
    });
  }
  const qRange = qMax - qMin || 1;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = r * CELL_PX;
      const y = c * CELL_PX;
      const key = makeKey(r, c);
      const isWall = walls.has(key);
      const isGoal = r === GOAL[0] && c === GOAL[1];
      const isStart = r === START[0] && c === START[1];

      // 셀 배경
      if (isWall) {
        ctx.fillStyle = '#4a5568';
      } else if (showQValues && !isGoal) {
        const vals = qTable.get(key);
        const mx = vals ? Math.max(...vals) : 0;
        const norm = Math.max(0, Math.min(1, (mx - qMin) / qRange));
        const red = Math.round(255 * (1 - norm));
        const green = Math.round(255 * norm);
        ctx.fillStyle = `rgba(${red}, ${green}, 60, 0.25)`;
      } else {
        ctx.fillStyle = bgPanel;
      }
      ctx.fillRect(x, y, CELL_PX, CELL_PX);

      // 셀 테두리
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL_PX - 1, CELL_PX - 1);

      // 방향 화살표
      if (showQValues && !isWall && !isGoal) {
        const vals = qTable.get(key);
        if (vals && Math.max(...vals) !== 0) {
          const best = argmax(vals);
          ctx.fillStyle = textMuted;
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ACTION_ARROWS[best], x + CELL_PX / 2, y + CELL_PX / 2);
        }
      }

      // 시작 지점
      if (isStart && !isWall) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(x + 2, y + 2, CELL_PX - 4, CELL_PX - 4);
        ctx.fillStyle = textMuted;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('S', x + CELL_PX / 2, y + CELL_PX - 4);
      }

      // 골 (녹색 별)
      if (isGoal) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fillRect(x + 2, y + 2, CELL_PX - 4, CELL_PX - 4);
        drawStar(ctx, x + CELL_PX / 2, y + CELL_PX / 2, 5, 14, 7, '#22c55e');
      }
    }
  }

  // 경로
  if (path && path.length > 1) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = path[i][0] * CELL_PX + CELL_PX / 2;
      const py = path[i][1] * CELL_PX + CELL_PX / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 에이전트 (파란 원 + glow)
  if (agentPos) {
    const ax = agentPos[0] * CELL_PX + CELL_PX / 2;
    const ay = agentPos[1] * CELL_PX + CELL_PX / 2;
    const grad = ctx.createRadialGradient(ax, ay, 4, ax, ay, 18);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ax, ay, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(ax, ay, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fill();
}

/* ────────── 보상 차트 Canvas ────────── */
function drawRewardChart(ctx, rewards, width, height) {
  ctx.clearRect(0, 0, width, height);

  const bgPanel = getCSSColor('--color-bg-panel', '#ffffff');
  const borderColor = getCSSColor('--color-border', '#e0e0e0');
  const textMuted = getCSSColor('--color-text-muted', '#999');
  const accent = getCSSColor('--color-accent', '#4A6CF7');

  ctx.fillStyle = bgPanel;
  ctx.fillRect(0, 0, width, height);

  if (rewards.length === 0) {
    ctx.fillStyle = textMuted;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('학습 시작 후 보상 그래프가 여기에 표시됩니다', width / 2, height / 2);
    return;
  }

  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const minR = Math.min(...rewards);
  const maxR = Math.max(...rewards);
  const rRange = maxR - minR || 1;

  // 축
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + chartH);
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.stroke();

  // Y축 라벨
  ctx.fillStyle = textMuted;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = minR + (rRange * i) / 4;
    const y = pad.top + chartH - (chartH * i) / 4;
    ctx.fillText(Math.round(val).toString(), pad.left - 6, y);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X축 라벨
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xStep = Math.max(1, Math.floor(rewards.length / 5));
  for (let i = 0; i < rewards.length; i += xStep) {
    const x = pad.left + (chartW * i) / (rewards.length - 1 || 1);
    ctx.fillText(String(i + 1), x, pad.top + chartH + 6);
  }

  // 이동 평균 (10개 윈도우)
  const windowSize = Math.min(10, rewards.length);
  const movingAvg = [];
  for (let i = 0; i < rewards.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += rewards[j];
    movingAvg.push(sum / (i - start + 1));
  }

  // 원본 데이터
  ctx.strokeStyle = `${accent}40`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < rewards.length; i++) {
    const x = pad.left + (chartW * i) / (rewards.length - 1 || 1);
    const y = pad.top + chartH - (chartH * (rewards[i] - minR)) / rRange;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 이동 평균 (진한 선)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < movingAvg.length; i++) {
    const x = pad.left + (chartW * i) / (movingAvg.length - 1 || 1);
    const y = pad.top + chartH - (chartH * (movingAvg[i] - minR)) / rRange;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 범례
  ctx.fillStyle = textMuted;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`에피소드: ${rewards.length}`, pad.left + 4, 4);
}

/* ═══════════════════════════════════════════════════════════════
   RLPlayground 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
export default function RLPlayground() {
  const { t } = useI18n();
  const step = useStepProgress(4);

  /* ── 하이퍼파라미터 ── */
  const [lr, setLr] = useState(0.1);
  const [gamma, setGamma] = useState(0.95);
  const [epsilon, setEpsilon] = useState(1.0);

  /* ── 보상 설계 (Step 3) ── */
  const [rewardGoal, setRewardGoal] = useState(100);
  const [rewardMove, setRewardMove] = useState(-1);

  /* ── 학습 상태 ── */
  const [isTraining, setIsTraining] = useState(false);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [bestReward, setBestReward] = useState(-Infinity);
  const [isAnimating, setIsAnimating] = useState(false);

  /* ── Step completion trackers ── */
  const [hasViewedPath, setHasViewedPath] = useState(false);
  const [hasRetrained, setHasRetrained] = useState(false);

  /* ── 그리드 상태 ── */
  const [walls, setWalls] = useState(() => new Set());
  const [agentPos, setAgentPos] = useState([...START]);
  const [path, setPath] = useState(null);

  /* ── refs ── */
  const gridCanvasRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const qTableRef = useRef(initQTable());
  const rewardsRef = useRef([]);
  const epsilonRef = useRef(1.0);
  const trainingRef = useRef(false);
  const animFrameRef = useRef(null);
  const animPathRef = useRef(null);
  const wallsRef = useRef(walls);
  const rewardGoalRef = useRef(rewardGoal);
  const rewardMoveRef = useRef(rewardMove);

  // ref 동기화
  useEffect(() => { wallsRef.current = walls; }, [walls]);
  useEffect(() => { rewardGoalRef.current = rewardGoal; }, [rewardGoal]);
  useEffect(() => { rewardMoveRef.current = rewardMove; }, [rewardMove]);

  /* ── HiDPI Canvas 초기화 ── */
  useEffect(() => {
    const gc = gridCanvasRef.current;
    const cc = chartCanvasRef.current;
    if (gc) setupHiDPICanvas(gc, CANVAS_PX, CANVAS_PX);
    if (cc) setupHiDPICanvas(cc, CHART_W, CHART_H);
  }, []);

  /* ── 그리드 렌더링 ── */
  const renderGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawGrid(ctx, wallsRef.current, qTableRef.current, agentPos, path, episodeCount > 0);
  }, [agentPos, path, episodeCount]);

  useEffect(() => { renderGrid(); }, [renderGrid, walls]);

  /* ── 차트 렌더링 ── */
  const renderChart = useCallback(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawRewardChart(ctx, rewardsRef.current, CHART_W, CHART_H);
  }, []);

  useEffect(() => { renderChart(); }, [renderChart, episodeCount]);

  /* ── 셀 클릭 (벽 토글) ── */
  const handleGridClick = useCallback((e) => {
    if (isAnimating) return;
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // HiDPI: map CSS pixels to logical pixels
    const px = (e.clientX - rect.left) * (CANVAS_PX / rect.width);
    const py = (e.clientY - rect.top) * (CANVAS_PX / rect.height);
    const r = Math.floor(px / CELL_PX);
    const c = Math.floor(py / CELL_PX);
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;
    if ((r === START[0] && c === START[1]) || (r === GOAL[0] && c === GOAL[1])) return;

    setWalls((prev) => {
      const next = new Set(prev);
      const key = makeKey(r, c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [isAnimating]);

  /* ── Step 1: 수동 이동 ── */
  const moveAgent = useCallback((dir) => {
    if (step.currentStep !== 1) return;
    setAgentPos((prev) => {
      const [dr, dc] = ACTIONS[dir];
      const nr = prev[0] + dr;
      const nc = prev[1] + dc;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return prev;
      if (wallsRef.current.has(makeKey(nr, nc))) return prev;
      const next = [nr, nc];
      // 목표 도달 확인
      if (nr === GOAL[0] && nc === GOAL[1]) {
        step.completeStep(1);
      }
      return next;
    });
  }, [step]);

  // 키보드 이벤트
  useEffect(() => {
    if (step.currentStep !== 1) return;
    const handler = (e) => {
      const keyMap = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
      if (keyMap[e.key] !== undefined) {
        e.preventDefault();
        moveAgent(keyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step.currentStep, moveAgent]);

  /* ── Q-Learning 한 에피소드 ── */
  const runEpisode = useCallback(() => {
    const Q = qTableRef.current;
    const currentWalls = wallsRef.current;
    const goalReward = rewardGoalRef.current;
    const moveReward = rewardMoveRef.current;
    let state = [...START];
    let totalReward = 0;
    const ep = epsilonRef.current;

    for (let s = 0; s < MAX_STEPS; s++) {
      const sKey = makeKey(state[0], state[1]);
      const qVals = Q.get(sKey);

      // epsilon-greedy
      let action;
      if (Math.random() < ep) {
        action = Math.floor(Math.random() * 4);
      } else {
        action = argmax(qVals);
      }

      const dr = ACTIONS[action][0];
      const dc = ACTIONS[action][1];
      let nr = state[0] + dr;
      let nc = state[1] + dc;
      let reward = moveReward;

      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || currentWalls.has(makeKey(nr, nc))) {
        nr = state[0];
        nc = state[1];
        reward = REWARD_WALL_BUMP;
      }

      if (nr === GOAL[0] && nc === GOAL[1]) {
        reward = goalReward;
      }

      const nsKey = makeKey(nr, nc);
      const nextQVals = Q.get(nsKey);
      const maxNextQ = Math.max(...nextQVals);
      qVals[action] += lr * (reward + gamma * maxNextQ - qVals[action]);

      totalReward += reward;
      state = [nr, nc];
      if (nr === GOAL[0] && nc === GOAL[1]) break;
    }

    // epsilon 감소
    epsilonRef.current = Math.max(0.01, epsilonRef.current * 0.995);
    return totalReward;
  }, [lr, gamma]);

  /* ── 학습 루프 ── */
  const startTraining = useCallback(() => {
    if (trainingRef.current) return;
    trainingRef.current = true;
    setIsTraining(true);
    setPath(null);

    function frame() {
      if (!trainingRef.current) return;
      for (let i = 0; i < EPISODES_PER_FRAME; i++) {
        const reward = runEpisode();
        rewardsRef.current.push(reward);
      }

      const count = rewardsRef.current.length;
      const best = Math.max(...rewardsRef.current.slice(-100));
      setEpisodeCount(count);
      setBestReward(best);

      const gridCanvas = gridCanvasRef.current;
      if (gridCanvas) {
        const ctx = gridCanvas.getContext('2d');
        drawGrid(ctx, wallsRef.current, qTableRef.current, null, null, true);
      }
      const chartCanvas = chartCanvasRef.current;
      if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        drawRewardChart(ctx, rewardsRef.current, CHART_W, CHART_H);
      }

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }, [runEpisode]);

  const pauseTraining = useCallback(() => {
    trainingRef.current = false;
    setIsTraining(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  /* ── 경로 애니메이션 ── */
  const animatePath = useCallback(() => {
    if (trainingRef.current) pauseTraining();
    const Q = qTableRef.current;
    const currentWalls = wallsRef.current;

    const pathArr = [[...START]];
    let state = [...START];
    const visited = new Set();
    visited.add(makeKey(state[0], state[1]));

    for (let s = 0; s < MAX_STEPS; s++) {
      const sKey = makeKey(state[0], state[1]);
      const qVals = Q.get(sKey);
      const action = argmax(qVals);
      const dr = ACTIONS[action][0];
      const dc = ACTIONS[action][1];
      let nr = state[0] + dr;
      let nc = state[1] + dc;

      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || currentWalls.has(makeKey(nr, nc))) {
        break;
      }
      state = [nr, nc];
      const nKey = makeKey(nr, nc);
      if (visited.has(nKey)) break;
      visited.add(nKey);
      pathArr.push([...state]);
      if (nr === GOAL[0] && nc === GOAL[1]) break;
    }

    if (pathArr.length <= 1) return;

    setIsAnimating(true);
    setPath(pathArr);
    setHasViewedPath(true);
    let idx = 0;

    function tick() {
      if (idx >= pathArr.length) {
        setIsAnimating(false);
        return;
      }
      setAgentPos(pathArr[idx]);
      idx++;
      animPathRef.current = setTimeout(tick, 150);
    }
    tick();
  }, [pauseTraining]);

  // Step 2 completion: 200+ episodes AND viewed path
  useEffect(() => {
    if (step.currentStep === 2 && episodeCount >= 200 && hasViewedPath) {
      step.completeStep(2);
    }
  }, [episodeCount, hasViewedPath, step]);

  // Step 3 completion: retrained with changed rewards
  useEffect(() => {
    if (step.currentStep === 3 && hasRetrained) {
      step.completeStep(3);
    }
  }, [hasRetrained, step]);

  /* ── 재학습 (Step 3) ── */
  const retrain = useCallback(() => {
    pauseTraining();
    if (animPathRef.current) {
      clearTimeout(animPathRef.current);
      animPathRef.current = null;
    }
    qTableRef.current = initQTable();
    rewardsRef.current = [];
    epsilonRef.current = 1.0;
    setEpisodeCount(0);
    setBestReward(-Infinity);
    setAgentPos([...START]);
    setPath(null);
    setIsAnimating(false);
    setHasRetrained(true);
    // 자동으로 학습 시작
    setTimeout(() => startTraining(), 50);
  }, [pauseTraining, startTraining]);

  /* ── 초기화 ── */
  const reset = useCallback(() => {
    pauseTraining();
    if (animPathRef.current) {
      clearTimeout(animPathRef.current);
      animPathRef.current = null;
    }
    qTableRef.current = initQTable();
    rewardsRef.current = [];
    epsilonRef.current = 1.0;
    setEpisodeCount(0);
    setBestReward(-Infinity);
    setAgentPos([...START]);
    setPath(null);
    setIsAnimating(false);
    setWalls(new Set());
    setHasViewedPath(false);
    setHasRetrained(false);
  }, [pauseTraining]);

  /* ── 언마운트 정리 ── */
  useEffect(() => {
    return () => {
      trainingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (animPathRef.current) clearTimeout(animPathRef.current);
    };
  }, []);

  /* ────────── 렌더 ────────── */
  const cs = step.currentStep;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* 상단 네비게이션 */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <Link
            to="/ai-lab"
            className="inline-flex items-center gap-1.5 text-sm font-medium no-underline transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            AI 실험실
          </Link>
        </div>

        {/* 타이틀 */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 184, 148, 0.1)' }}
            >
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="6" height="6" rx="1" fill="#00B894" opacity="0.3" />
                <rect x="13" y="4" width="6" height="6" rx="1" fill="#00B894" opacity="0.5" />
                <rect x="22" y="4" width="6" height="6" rx="1" fill="#00B894" opacity="0.3" />
                <rect x="4" y="13" width="6" height="6" rx="1" fill="#00B894" opacity="0.5" />
                <rect x="13" y="13" width="6" height="6" rx="1" fill="#00B894" opacity="0.9" />
                <rect x="22" y="13" width="6" height="6" rx="1" fill="#00B894" opacity="0.5" />
                <rect x="4" y="22" width="6" height="6" rx="1" fill="#00B894" opacity="0.3" />
                <rect x="13" y="22" width="6" height="6" rx="1" fill="#00B894" opacity="0.5" />
                <rect x="22" y="22" width="6" height="6" rx="1" fill="#00B894" opacity="0.7" />
              </svg>
            </div>
            <div>
              <h1
                className="font-display text-2xl sm:text-3xl font-black"
                style={{ color: 'var(--color-text-primary)' }}
              >
                AI 걸음마 놀이터
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Q-Learning으로 에이전트가 목표까지 가는 길을 스스로 배웁니다
              </p>
            </div>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-4">
          <StepIndicator
            steps={STEP_DEFS}
            currentStep={step.currentStep}
            completedSteps={step.completedSteps}
            onStepClick={step.goToStep}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          {/* 현재 스텝 안내 메시지 */}
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-accent-bg, rgba(74, 108, 247, 0.06))',
              border: '1px solid var(--color-accent)',
              color: 'var(--color-accent)',
            }}
          >
            {cs === 1 && '방향키 또는 버튼으로 에이전트를 목표까지 옮겨보세요!'}
            {cs === 2 && (
              episodeCount < 200
                ? '학습 시작 버튼을 눌러 AI가 스스로 길을 찾는 과정을 관찰하세요!'
                : !hasViewedPath
                  ? '학습이 충분히 진행되었습니다. 경로 보기를 눌러 결과를 확인하세요!'
                  : '훌륭합니다! 다음 단계로 진행할 수 있습니다.'
            )}
            {cs === 3 && '보상을 바꾸면 AI의 행동이 어떻게 달라질까요? 값을 조절하고 재학습해 보세요!'}
            {cs === 4 && '모든 하이퍼파라미터를 자유롭게 실험하세요. 당신은 이제 마스터입니다!'}
          </div>

          {/* 그리드 + 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 그리드 월드 */}
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h2
                className="font-display text-base font-bold mb-3"
                style={{ color: 'var(--color-text-primary)' }}
              >
                그리드 월드
                <span className="text-xs font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                  셀을 클릭해서 벽을 만들어 보세요
                </span>
              </h2>
              <div className="flex justify-center">
                <canvas
                  ref={gridCanvasRef}
                  onClick={handleGridClick}
                  className="cursor-pointer rounded-xl"
                  style={{
                    border: '1px solid var(--color-border)',
                    maxWidth: '100%',
                    height: 'auto',
                  }}
                />
              </div>
              {/* 범례 */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
                  에이전트
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  목표
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: '#4a5568' }} />
                  벽
                </span>
                {cs >= 2 && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {ACTION_ARROWS[1]}
                    </span>
                    최적 행동
                  </span>
                )}
              </div>
            </div>

            {/* 보상 차트 - Step 2 이상에서 표시 */}
            {cs >= 2 ? (
              <div
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h2
                  className="font-display text-base font-bold mb-3"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  보상 그래프
                  <span className="text-xs font-normal ml-2" style={{ color: 'var(--color-text-muted)' }}>
                    에피소드별 총 보상
                  </span>
                </h2>
                <div className="flex justify-center">
                  <canvas
                    ref={chartCanvasRef}
                    className="rounded-xl"
                    style={{
                      border: '1px solid var(--color-border)',
                      maxWidth: '100%',
                      height: 'auto',
                    }}
                  />
                </div>
                {/* 통계 */}
                <div className="flex flex-wrap items-center gap-6 mt-4">
                  <div>
                    <span className="text-xs block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      에피소드
                    </span>
                    <span className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {episodeCount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      최근 최고 보상
                    </span>
                    <span
                      className="font-mono text-lg font-bold"
                      style={{ color: bestReward > 0 ? 'var(--color-success)' : 'var(--color-text-primary)' }}
                    >
                      {bestReward === -Infinity ? '\u2014' : Math.round(bestReward)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      현재 탐험률
                    </span>
                    <span className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {epsilonRef.current.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 1: 조작 안내 패널 */
              <div
                className="rounded-2xl p-5 flex flex-col items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <p className="text-sm mb-6 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                  아래 방향 버튼이나 키보드 화살표로<br />에이전트(파란 원)를 목표(녹색 별)까지 이동하세요.
                </p>
                {/* 방향 버튼 패드 */}
                <div className="grid grid-cols-3 gap-2 w-fit">
                  <div />
                  <DirectionButton icon={<ArrowUpIcon size={20} />} onClick={() => moveAgent(0)} label="위" />
                  <div />
                  <DirectionButton icon={<ArrowLeftIcon size={20} />} onClick={() => moveAgent(3)} label="왼쪽" />
                  <DirectionButton icon={<ArrowDownIcon size={20} />} onClick={() => moveAgent(2)} label="아래" />
                  <DirectionButton icon={<ArrowRightIcon size={20} />} onClick={() => moveAgent(1)} label="오른쪽" />
                </div>
                <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
                  현재 위치: ({agentPos[0]}, {agentPos[1]})
                </p>
              </div>
            )}
          </div>

          {/* ════════════ 컨트롤 패널 (스텝별 분기) ════════════ */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Step 1: 방향 컨트롤 (모바일용 추가 영역) */}
            {cs === 1 && (
              <div>
                <h2 className="font-display text-base font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  에이전트 조작
                </h2>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <DirectionButton icon={<ArrowUpIcon size={18} />} onClick={() => moveAgent(0)} label="위" />
                    <DirectionButton icon={<ArrowDownIcon size={18} />} onClick={() => moveAgent(2)} label="아래" />
                    <DirectionButton icon={<ArrowLeftIcon size={18} />} onClick={() => moveAgent(3)} label="왼쪽" />
                    <DirectionButton icon={<ArrowRightIcon size={18} />} onClick={() => moveAgent(1)} label="오른쪽" />
                  </div>
                  <button onClick={reset} className="btn-secondary inline-flex items-center gap-2">
                    <ResetIcon size={14} />
                    초기화
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: AI 학습 컨트롤 */}
            {cs === 2 && (
              <div>
                <h2 className="font-display text-base font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  AI 학습
                </h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={isTraining ? pauseTraining : startTraining}
                    className={isTraining ? 'btn-secondary' : 'btn-primary'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isTraining ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                    {isTraining ? '일시정지' : '학습 시작'}
                  </button>

                  {episodeCount >= 100 && (
                    <button
                      onClick={animatePath}
                      disabled={isAnimating}
                      className="btn-secondary inline-flex items-center gap-2"
                      style={{ opacity: isAnimating ? 0.5 : 1 }}
                    >
                      <MapIcon size={14} />
                      경로 보기
                    </button>
                  )}

                  <button
                    onClick={reset}
                    disabled={isAnimating}
                    className="btn-secondary inline-flex items-center gap-2"
                    style={{ opacity: isAnimating ? 0.5 : 1 }}
                  >
                    <ResetIcon size={14} />
                    초기화
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 보상 설계 */}
            {cs === 3 && (
              <div>
                <h2 className="font-display text-base font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  보상 설계
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>목표 도달 보상</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {rewardGoal}
                      </span>
                    </label>
                    <input
                      type="range" min="10" max="200" step="10"
                      value={rewardGoal}
                      onChange={(e) => setRewardGoal(parseInt(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>이동 패널티</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {rewardMove.toFixed(1)}
                      </span>
                    </label>
                    <input
                      type="range" min="-5" max="-0.1" step="0.1"
                      value={rewardMove}
                      onChange={(e) => setRewardMove(parseFloat(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={retrain}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <PlayIcon size={14} />
                    재학습
                  </button>
                  {isTraining && (
                    <button onClick={pauseTraining} className="btn-secondary inline-flex items-center gap-2">
                      <PauseIcon size={14} />
                      일시정지
                    </button>
                  )}
                  {episodeCount >= 100 && (
                    <button
                      onClick={animatePath}
                      disabled={isAnimating}
                      className="btn-secondary inline-flex items-center gap-2"
                      style={{ opacity: isAnimating ? 0.5 : 1 }}
                    >
                      <MapIcon size={14} />
                      경로 보기
                    </button>
                  )}
                  <button onClick={reset} disabled={isAnimating}
                    className="btn-secondary inline-flex items-center gap-2"
                    style={{ opacity: isAnimating ? 0.5 : 1 }}
                  >
                    <ResetIcon size={14} />
                    초기화
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: 하이퍼파라미터 마스터 */}
            {cs === 4 && (
              <div>
                <h2 className="font-display text-base font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  하이퍼파라미터
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>학습률 (alpha)</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {lr.toFixed(2)}
                      </span>
                    </label>
                    <input
                      type="range" min="0.01" max="1" step="0.01"
                      value={lr} onChange={(e) => setLr(parseFloat(e.target.value))}
                      disabled={isTraining} className="w-full"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>할인율 (gamma)</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {gamma.toFixed(2)}
                      </span>
                    </label>
                    <input
                      type="range" min="0.5" max="0.99" step="0.01"
                      value={gamma} onChange={(e) => setGamma(parseFloat(e.target.value))}
                      disabled={isTraining} className="w-full"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>탐험률 (epsilon)</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {epsilon.toFixed(2)}
                      </span>
                    </label>
                    <input
                      type="range" min="0.1" max="1" step="0.01"
                      value={epsilon} onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                      disabled={isTraining} className="w-full"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
                {/* 보상 설계도 Step 4에서 계속 사용 가능 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>목표 도달 보상</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {rewardGoal}
                      </span>
                    </label>
                    <input
                      type="range" min="10" max="200" step="10"
                      value={rewardGoal} onChange={(e) => setRewardGoal(parseInt(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-sm mb-2">
                      <span style={{ color: 'var(--color-text-secondary)' }}>이동 패널티</span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
                        {rewardMove.toFixed(1)}
                      </span>
                    </label>
                    <input
                      type="range" min="-5" max="-0.1" step="0.1"
                      value={rewardMove} onChange={(e) => setRewardMove(parseFloat(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={isTraining ? pauseTraining : startTraining}
                    className={isTraining ? 'btn-secondary' : 'btn-primary'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isTraining ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                    {isTraining ? '일시정지' : '학습 시작'}
                  </button>
                  <button onClick={retrain} className="btn-secondary inline-flex items-center gap-2">
                    <ResetIcon size={14} />
                    재학습
                  </button>
                  {episodeCount >= 100 && (
                    <button
                      onClick={animatePath} disabled={isAnimating}
                      className="btn-secondary inline-flex items-center gap-2"
                      style={{ opacity: isAnimating ? 0.5 : 1 }}
                    >
                      <MapIcon size={14} />
                      경로 보기
                    </button>
                  )}
                  <button onClick={reset} disabled={isAnimating}
                    className="btn-secondary inline-flex items-center gap-2"
                    style={{ opacity: isAnimating ? 0.5 : 1 }}
                  >
                    <ResetIcon size={14} />
                    전체 초기화
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ════════════ 설명 카드 (스텝별) ════════════ */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
            }}
          >
            {cs === 1 && (
              <>
                <h3 className="font-display text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  강화학습이란?
                </h3>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p className="mb-2">
                    에이전트가 <strong>환경</strong> 속에서 <strong>행동</strong>하고 <strong>보상</strong>을 받으며 학습하는 방식입니다.
                    지금 여러분이 직접 에이전트를 조작해 보면서, 최단 경로를 찾는 것이 얼마나 어려운지 느껴보세요.
                  </p>
                  <p>
                    벽을 만들어 미로를 더 복잡하게 만들어 볼 수도 있습니다. 다음 단계에서는 AI가 이 작업을 대신합니다!
                  </p>
                </div>
              </>
            )}
            {cs === 2 && (
              <>
                <h3 className="font-display text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Q-Learning이란?
                </h3>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p className="mb-2">
                    에이전트가 <strong>시행착오</strong>를 통해 최적의 행동을 학습하는 강화학습 알고리즘입니다.
                    각 상태에서 어떤 행동이 얼마나 좋은지를 <strong>Q-값</strong>으로 기록합니다.
                  </p>
                  <p>
                    그리드의 색상이 빨강에서 녹색으로 변하는 것은 Q-값의 크기를 나타냅니다.
                    녹색일수록 목표에 가까운 좋은 상태를 의미합니다.
                  </p>
                </div>
              </>
            )}
            {cs === 3 && (
              <>
                <h3 className="font-display text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  보상 설계의 중요성
                </h3>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p className="mb-2">
                    <strong>목표 도달 보상</strong>을 높이면 에이전트가 목표를 더 적극적으로 찾습니다.
                    <strong>이동 패널티</strong>를 크게 하면 최단 경로를 선호하게 됩니다.
                  </p>
                  <p>
                    현실 세계의 AI도 보상 설계가 매우 중요합니다.
                    잘못된 보상은 예상치 못한 행동을 만들어냅니다.
                  </p>
                </div>
              </>
            )}
            {cs === 4 && (
              <>
                <h3 className="font-display text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  하이퍼파라미터 가이드
                </h3>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <p className="mb-2">
                    <strong>학습률(alpha)</strong>: 새로운 경험을 얼마나 빠르게 반영할지를 결정합니다.
                    높으면 빠르게 학습하지만 불안정할 수 있고, 낮으면 안정적이지만 느립니다.
                  </p>
                  <p className="mb-2">
                    <strong>할인율(gamma)</strong>: 미래 보상을 얼마나 중요하게 볼지 결정합니다.
                    1에 가까우면 장기적 이익을 중시하고, 낮으면 즉각적 보상을 선호합니다.
                  </p>
                  <p>
                    <strong>탐험률(epsilon)</strong>: 학습 중 랜덤 행동의 비율입니다.
                    높으면 다양한 경로를 시도하고, 낮으면 이미 알려진 최선의 행동을 따릅니다.
                    학습이 진행될수록 자동으로 감소합니다.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <footer
          className="text-center text-sm py-8"
          style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}
        >
          <p>{t('home.author')}</p>
        </footer>
      </main>

      {/* 스텝 전환 오버레이 */}
      {step.showTransition && step.currentStep < 4 && (
        <StepTransition
          nextStepTitle={STEP_DEFS[step.currentStep]?.title}
          onNext={step.dismissTransition}
        />
      )}
    </div>
  );
}

/* ────────── 방향 버튼 컴포넌트 ────────── */
function DirectionButton({ icon, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        e.currentTarget.style.color = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.color = 'var(--color-text-secondary)';
      }}
    >
      {icon}
    </button>
  );
}
