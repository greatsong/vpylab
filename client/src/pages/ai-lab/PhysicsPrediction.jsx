import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import { useI18n } from '../../i18n';
import Header from '../../components/layout/Header';
import StepIndicator, { useStepProgress, StepTransition } from '../../components/shared/StepIndicator';
import { PlayIcon, ResetIcon, LaunchIcon, StarIcon } from '../../components/shared/Icons';
import { setupHiDPICanvas, getCSSColor } from '../../utils/canvasHiDPI';

/* ────────── 상수 ────────── */
const G = 9.8;
const CANVAS_W = 800;
const CANVAS_H = 400;
const GROUND_Y = CANVAS_H * 0.85;
const LAUNCHER_X = 60;
const SCALE = 7;
const ANIM_SPEED = 2.5;

const STEPS = [
  { title: '포물선 관찰' },
  { title: '내가 예측' },
  { title: 'AI 등장' },
  { title: 'AI를 이겨라!' },
];

/* ────────── 물리 계산 ────────── */
function calcLandingX(angleDeg, velocity) {
  const rad = (angleDeg * Math.PI) / 180;
  return (velocity * velocity * Math.sin(2 * rad)) / G;
}

function calcLandingTime(angleDeg, velocity) {
  const rad = (angleDeg * Math.PI) / 180;
  return (2 * velocity * Math.sin(rad)) / G;
}

function calcPosition(angleDeg, velocity, t) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: velocity * Math.cos(rad) * t,
    y: velocity * Math.sin(rad) * t - 0.5 * G * t * t,
  };
}

/* ────────── 좌표 변환 ────────── */
function metersToCanvas(mx, my) {
  return { cx: LAUNCHER_X + mx * SCALE, cy: GROUND_Y - my * SCALE };
}
function canvasToMetersX(cx) {
  return (cx - LAUNCHER_X) / SCALE;
}

/* ────────── AI 모델 ────────── */
function createModel() {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [2] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
  return model;
}

/* ────────── 랜덤 파라미터 ────────── */
function randomParams() {
  return {
    angle: Math.floor(Math.random() * 51) + 20,
    velocity: Math.floor(Math.random() * 26) + 15,
  };
}

/* ────────── 캔버스 공통 드로잉 ────────── */
function drawSky(ctx) {
  const topColor = getCSSColor('--color-bg-primary', '#B3D9FF');
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#B3D9FF');
  skyGrad.addColorStop(1, '#E8F4FD');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  [[120, 60, 40], [350, 40, 30], [600, 70, 35]].forEach(([cx, cy, r]) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGround(ctx) {
  const gndGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
  gndGrad.addColorStop(0, '#7CB342');
  gndGrad.addColorStop(1, '#558B2F');
  ctx.fillStyle = gndGrad;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // 잔디 텍스처
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < CANVAS_W; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, GROUND_Y);
    ctx.lineTo(i + 3, GROUND_Y - 4);
    ctx.stroke();
  }
}

function drawScale(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.font = '10px var(--font-mono, monospace)';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let m = 10; m <= 120; m += 10) {
    const cx = LAUNCHER_X + m * SCALE;
    if (cx > CANVAS_W - 20) break;
    ctx.beginPath();
    ctx.moveTo(cx, GROUND_Y);
    ctx.lineTo(cx, GROUND_Y + 6);
    ctx.stroke();
    ctx.fillText(`${m}m`, cx, GROUND_Y + 16);
  }
}

function drawLauncher(ctx, angleDeg, velocity) {
  const rad = (angleDeg * Math.PI) / 180;
  const barrelLen = 30;

  // 발사대 몸체
  ctx.fillStyle = '#4B5563';
  ctx.beginPath();
  ctx.arc(LAUNCHER_X, GROUND_Y, 12, 0, Math.PI, true);
  ctx.fill();

  // 포신
  ctx.strokeStyle = '#6366F1';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LAUNCHER_X, GROUND_Y);
  ctx.lineTo(LAUNCHER_X + Math.cos(rad) * barrelLen, GROUND_Y - Math.sin(rad) * barrelLen);
  ctx.stroke();

  // 각도 호
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(LAUNCHER_X, GROUND_Y, 22, -rad, 0);
  ctx.stroke();

  // 각도 텍스트
  ctx.fillStyle = '#6366F1';
  ctx.font = 'bold 11px var(--font-mono, monospace)';
  ctx.textAlign = 'left';
  ctx.fillText(`${angleDeg}°`, LAUNCHER_X + 26, GROUND_Y - 8);

  // 속도 화살표
  const arrowLen = Math.min(velocity * 1.2, 50);
  const ax = LAUNCHER_X + Math.cos(rad) * (barrelLen + 5);
  const ay = GROUND_Y - Math.sin(rad) * (barrelLen + 5);
  const aex = ax + Math.cos(rad) * arrowLen;
  const aey = ay - Math.sin(rad) * arrowLen;
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(aex, aey);
  ctx.stroke();
  ctx.setLineDash([]);

  const headLen = 8;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(aex, aey);
  ctx.lineTo(aex - Math.cos(rad - 0.4) * headLen, aey + Math.sin(rad - 0.4) * headLen);
  ctx.lineTo(aex - Math.cos(rad + 0.4) * headLen, aey + Math.sin(rad + 0.4) * headLen);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 11px var(--font-mono, monospace)';
  ctx.fillText(`${velocity} m/s`, aex + 5, aey - 5);
}

function drawTrajectory(ctx, angleDeg, velocity) {
  const tLand = calcLandingTime(angleDeg, velocity);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let t = 0; t <= tLand; t += 0.02) {
    const pos = calcPosition(angleDeg, velocity, t);
    const { cx, cy } = metersToCanvas(pos.x, pos.y);
    t === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFlag(ctx, x, groundY, color, label) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - 35);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 35);
  ctx.lineTo(x + 20, groundY - 28);
  ctx.lineTo(x, groundY - 21);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 3, groundY - 26);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, groundY, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiamond(ctx, x, groundY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 12);
  ctx.lineTo(x + 8, groundY);
  ctx.lineTo(x, groundY + 4);
  ctx.lineTo(x - 8, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('착지', x, groundY - 16);
}

function drawBall(ctx, pos) {
  const { cx, cy } = metersToCanvas(pos.x, pos.y);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, GROUND_Y + 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 공
  const ballGrad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 8);
  ballGrad.addColorStop(0, '#FBBF24');
  ballGrad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* ═══════════════════════════════════════════════════════════════
   PhysicsPrediction 컴포넌트 — 4단계 스캐폴딩
   ═══════════════════════════════════════════════════════════════ */
export default function PhysicsPrediction() {
  const { t } = useI18n();
  const stepProgress = useStepProgress(4);
  const { currentStep, completedSteps, showTransition, completeStep, goToStep, dismissTransition } = stepProgress;

  /* ── 공통 상태 ── */
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);

  /* ── Step 1 상태 ── */
  const [s1Angle, setS1Angle] = useState(45);
  const [s1Velocity, setS1Velocity] = useState(25);
  const [s1Phase, setS1Phase] = useState('ready'); // ready, animating, landed
  const [s1Launches, setS1Launches] = useState(0);
  const [s1UsedAngles, setS1UsedAngles] = useState(new Set());

  /* ── Step 2 상태 ── */
  const [s2Params, setS2Params] = useState(randomParams);
  const [s2Phase, setS2Phase] = useState('predict'); // predict, predicted, animating, result
  const [s2Prediction, setS2Prediction] = useState(null);
  const [s2Predictions, setS2Predictions] = useState(0);

  /* ── Step 3 상태 ── */
  const [s3Params, setS3Params] = useState(randomParams);
  const [s3Phase, setS3Phase] = useState('predict');
  const [s3Prediction, setS3Prediction] = useState(null);
  const [s3AiPrediction, setS3AiPrediction] = useState(null);
  const [s3Scores, setS3Scores] = useState({ student: 0, ai: 0 });
  const [s3Rounds, setS3Rounds] = useState(0);

  /* ── Step 4 상태 ── */
  const [s4Params, setS4Params] = useState(randomParams);
  const [s4Phase, setS4Phase] = useState('predict');
  const [s4Prediction, setS4Prediction] = useState(null);
  const [s4AiPrediction, setS4AiPrediction] = useState(null);
  const [s4Round, setS4Round] = useState(1);
  const [s4Scores, setS4Scores] = useState({ student: 0, ai: 0 });
  const [s4Results, setS4Results] = useState([]);
  const TOTAL_ROUNDS = 5;

  /* ── AI 모델 & 데이터 ── */
  const modelRef = useRef(null);
  const trainingDataRef = useRef([]);
  const [aiDataCount, setAiDataCount] = useState(0);

  /* ── 착지/궤적 렌더링용 ── */
  const [landedData, setLandedData] = useState(null);
  // { angle, velocity, landingX, studentPred?, aiPred? }

  /* ── 모델 초기화 & 정리 ── */
  useEffect(() => {
    modelRef.current = createModel();
    return () => {
      if (modelRef.current) modelRef.current.dispose();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ── HiDPI 캔버스 설정 ── */
  const ctxRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = setupHiDPICanvas(canvas, CANVAS_W, CANVAS_H);
  }, []);

  /* ── AI 예측 ── */
  const getAIPrediction = useCallback((angle, velocity) => {
    const actual = calcLandingX(angle, velocity);
    const dataCount = trainingDataRef.current.length;

    if (dataCount < 2) {
      const noise = (Math.random() - 0.5) * 0.6;
      return Math.max(5, actual * (1 + noise));
    }

    try {
      const input = tf.tensor2d([[angle / 70, velocity / 40]]);
      const pred = modelRef.current.predict(input);
      const val = pred.dataSync()[0];
      input.dispose();
      pred.dispose();
      return Math.max(5, val);
    } catch {
      const noise = (Math.random() - 0.5) * 0.3;
      return Math.max(5, actual * (1 + noise));
    }
  }, []);

  /* ── AI 학습 ── */
  const trainAI = useCallback(async (newData) => {
    const data = trainingDataRef.current;
    data.push(newData);
    setAiDataCount(data.length);

    if (data.length < 2) return;

    try {
      const xs = tf.tensor2d(data.map(d => [d.angle / 70, d.velocity / 40]));
      const ys = tf.tensor2d(data.map(d => [d.landingX]));
      await modelRef.current.fit(xs, ys, {
        epochs: Math.min(50 + data.length * 10, 100),
        batchSize: Math.max(1, Math.floor(data.length / 2)),
        shuffle: true,
        verbose: 0,
      });
      xs.dispose();
      ys.dispose();
    } catch (err) {
      console.warn('AI 학습 오류:', err);
    }
  }, []);

  /* ── 캔버스 렌더링 ── */
  const drawScene = useCallback((ballPos = null) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawSky(ctx);
    drawGround(ctx);
    drawScale(ctx);

    // 현재 단계에 따른 파라미터
    let angle, velocity;
    if (currentStep === 1) { angle = s1Angle; velocity = s1Velocity; }
    else if (currentStep === 2) { angle = s2Params.angle; velocity = s2Params.velocity; }
    else if (currentStep === 3) { angle = s3Params.angle; velocity = s3Params.velocity; }
    else { angle = s4Params.angle; velocity = s4Params.velocity; }

    drawLauncher(ctx, angle, velocity);

    // 착지 후 궤적
    if (landedData) {
      drawTrajectory(ctx, landedData.angle, landedData.velocity);

      // 학생 예측 깃발 (step 2+)
      if (landedData.studentPred != null) {
        const { cx } = metersToCanvas(landedData.studentPred, 0);
        drawFlag(ctx, cx, GROUND_Y, '#3B82F6', '나');
      }

      // AI 예측 깃발 (step 3+)
      if (landedData.aiPred != null) {
        const { cx } = metersToCanvas(landedData.aiPred, 0);
        drawFlag(ctx, cx, GROUND_Y, '#EF4444', 'AI');
      }

      // 실제 착지점
      const { cx } = metersToCanvas(landedData.landingX, 0);
      drawDiamond(ctx, cx, GROUND_Y, '#22C55E');
    }

    // 아직 발사 전 예측 마커들
    if (!landedData) {
      if (currentStep === 2 && s2Prediction != null) {
        const { cx } = metersToCanvas(s2Prediction, 0);
        drawFlag(ctx, cx, GROUND_Y, '#3B82F6', '나');
      }
      if (currentStep === 3 && s3Prediction != null) {
        const { cx } = metersToCanvas(s3Prediction, 0);
        drawFlag(ctx, cx, GROUND_Y, '#3B82F6', '나');
        if (s3AiPrediction != null) {
          const { cx: acx } = metersToCanvas(s3AiPrediction, 0);
          drawFlag(ctx, acx, GROUND_Y, '#EF4444', 'AI');
        }
      }
      if (currentStep === 4 && s4Prediction != null) {
        const { cx } = metersToCanvas(s4Prediction, 0);
        drawFlag(ctx, cx, GROUND_Y, '#3B82F6', '나');
        if (s4AiPrediction != null) {
          const { cx: acx } = metersToCanvas(s4AiPrediction, 0);
          drawFlag(ctx, acx, GROUND_Y, '#EF4444', 'AI');
        }
      }
    }

    // 캔버스 상단 안내 텍스트
    if (currentStep === 1 && s1Phase === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('슬라이더로 각도와 속도를 조절한 뒤 발사 버튼을 누르세요!', CANVAS_W / 2, 28);
    }
    if (currentStep === 2 && s2Phase === 'predict') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('지면을 클릭하여 착지점을 예측하세요!', CANVAS_W / 2, 28);
    }
    if (currentStep === 3 && s3Phase === 'predict') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('지면을 클릭하여 착지점을 예측하세요! (AI도 예측합니다)', CANVAS_W / 2, 28);
    }
    if (currentStep === 4 && s4Phase === 'predict') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[라운드 ${s4Round}/5] 지면을 클릭하여 착지점을 예측하세요!`, CANVAS_W / 2, 28);
    }

    // 비행 중 공
    if (ballPos) drawBall(ctx, ballPos);

    ctx.restore();
  }, [currentStep, s1Angle, s1Velocity, s1Phase, s2Params, s2Phase, s2Prediction,
      s3Params, s3Phase, s3Prediction, s3AiPrediction,
      s4Params, s4Phase, s4Prediction, s4AiPrediction, s4Round,
      landedData]);

  /* ── 캔버스 리렌더 ── */
  useEffect(() => {
    drawScene();
  }, [drawScene]);

  /* ── 발사 애니메이션 ── */
  const animateLaunch = useCallback((angle, velocity, onLand) => {
    const tLand = calcLandingTime(angle, velocity);
    let startTime = null;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const simTime = ((timestamp - startTime) / 1000) * ANIM_SPEED;

      if (simTime >= tLand) {
        onLand();
        return;
      }

      const pos = calcPosition(angle, velocity, simTime);
      drawScene(pos);
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [drawScene]);

  /* ── 캔버스 클릭 (학생 예측) ── */
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const clickX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const clickY = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    if (clickY < GROUND_Y - 30 || clickX < LAUNCHER_X) return;
    const metersX = canvasToMetersX(clickX);
    if (metersX < 1) return;

    if (currentStep === 2 && s2Phase === 'predict') {
      setS2Prediction(metersX);
      setS2Phase('predicted');
    }
    if (currentStep === 3 && s3Phase === 'predict') {
      setS3Prediction(metersX);
      const aiGuess = getAIPrediction(s3Params.angle, s3Params.velocity);
      setS3AiPrediction(aiGuess);
      setS3Phase('predicted');
    }
    if (currentStep === 4 && s4Phase === 'predict') {
      setS4Prediction(metersX);
      const aiGuess = getAIPrediction(s4Params.angle, s4Params.velocity);
      setS4AiPrediction(aiGuess);
      setS4Phase('predicted');
    }
  }, [currentStep, s2Phase, s3Phase, s3Params, s4Phase, s4Params, getAIPrediction]);

  /* ═══════ Step 1: 발사 ═══════ */
  const handleStep1Launch = useCallback(() => {
    if (s1Phase !== 'ready') return;
    setS1Phase('animating');
    setLandedData(null);

    animateLaunch(s1Angle, s1Velocity, () => {
      const landX = calcLandingX(s1Angle, s1Velocity);
      setLandedData({ angle: s1Angle, velocity: s1Velocity, landingX: landX });
      setS1Phase('landed');

      const newCount = s1Launches + 1;
      setS1Launches(newCount);
      const newAngles = new Set(s1UsedAngles);
      newAngles.add(s1Angle);
      setS1UsedAngles(newAngles);

      // 학습 데이터 축적 (step 3을 위해)
      trainAI({ angle: s1Angle, velocity: s1Velocity, landingX: landX });

      // 완료 조건: 3회 이상 발사, 2개 이상 다른 각도
      if (newCount >= 3 && newAngles.size >= 2) {
        completeStep(1);
      }
    });
  }, [s1Phase, s1Angle, s1Velocity, s1Launches, s1UsedAngles, animateLaunch, trainAI, completeStep]);

  const handleStep1Reset = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setS1Phase('ready');
    setLandedData(null);
  }, []);

  /* ═══════ Step 2: 발사 ═══════ */
  const handleStep2Launch = useCallback(() => {
    if (s2Phase !== 'predicted') return;
    setS2Phase('animating');
    setLandedData(null);

    animateLaunch(s2Params.angle, s2Params.velocity, () => {
      const landX = calcLandingX(s2Params.angle, s2Params.velocity);
      setLandedData({
        angle: s2Params.angle, velocity: s2Params.velocity,
        landingX: landX, studentPred: s2Prediction,
      });
      trainAI({ angle: s2Params.angle, velocity: s2Params.velocity, landingX: landX });
      setS2Phase('result');

      const newCount = s2Predictions + 1;
      setS2Predictions(newCount);
      if (newCount >= 3) completeStep(2);
    });
  }, [s2Phase, s2Params, s2Prediction, s2Predictions, animateLaunch, trainAI, completeStep]);

  const handleStep2Next = useCallback(() => {
    setS2Params(randomParams());
    setS2Prediction(null);
    setLandedData(null);
    setS2Phase('predict');
  }, []);

  /* ═══════ Step 3: 발사 ═══════ */
  const handleStep3Launch = useCallback(() => {
    if (s3Phase !== 'predicted') return;
    setS3Phase('animating');
    setLandedData(null);

    animateLaunch(s3Params.angle, s3Params.velocity, () => {
      const landX = calcLandingX(s3Params.angle, s3Params.velocity);
      setLandedData({
        angle: s3Params.angle, velocity: s3Params.velocity,
        landingX: landX, studentPred: s3Prediction, aiPred: s3AiPrediction,
      });
      trainAI({ angle: s3Params.angle, velocity: s3Params.velocity, landingX: landX });

      const studentDist = Math.abs(s3Prediction - landX);
      const aiDist = Math.abs(s3AiPrediction - landX);
      const winner = studentDist <= aiDist ? 'student' : 'ai';
      setS3Scores(prev => ({ ...prev, [winner]: prev[winner] + 1 }));

      setS3Phase('result');
      const newRounds = s3Rounds + 1;
      setS3Rounds(newRounds);
      if (newRounds >= 3) completeStep(3);
    });
  }, [s3Phase, s3Params, s3Prediction, s3AiPrediction, s3Rounds, animateLaunch, trainAI, completeStep]);

  const handleStep3Next = useCallback(() => {
    setS3Params(randomParams());
    setS3Prediction(null);
    setS3AiPrediction(null);
    setLandedData(null);
    setS3Phase('predict');
  }, []);

  /* ═══════ Step 4: 발사 ═══════ */
  const handleStep4Launch = useCallback(() => {
    if (s4Phase !== 'predicted') return;
    setS4Phase('animating');
    setLandedData(null);

    animateLaunch(s4Params.angle, s4Params.velocity, () => {
      const landX = calcLandingX(s4Params.angle, s4Params.velocity);
      setLandedData({
        angle: s4Params.angle, velocity: s4Params.velocity,
        landingX: landX, studentPred: s4Prediction, aiPred: s4AiPrediction,
      });
      trainAI({ angle: s4Params.angle, velocity: s4Params.velocity, landingX: landX });

      const studentDist = Math.abs(s4Prediction - landX);
      const aiDist = Math.abs(s4AiPrediction - landX);
      const winner = studentDist <= aiDist ? 'student' : 'ai';
      setS4Scores(prev => ({ ...prev, [winner]: prev[winner] + 1 }));

      setS4Results(prev => [...prev, {
        round: s4Round,
        angle: s4Params.angle,
        velocity: s4Params.velocity,
        actual: landX,
        studentGuess: s4Prediction,
        aiGuess: s4AiPrediction,
        studentDist,
        aiDist,
        winner,
      }]);

      setS4Phase(s4Round >= TOTAL_ROUNDS ? 'finished' : 'result');
    });
  }, [s4Phase, s4Params, s4Prediction, s4AiPrediction, s4Round, animateLaunch, trainAI]);

  const handleStep4Next = useCallback(() => {
    setS4Round(r => r + 1);
    setS4Params(randomParams());
    setS4Prediction(null);
    setS4AiPrediction(null);
    setLandedData(null);
    setS4Phase('predict');
  }, []);

  const handleStep4Restart = useCallback(() => {
    if (modelRef.current) modelRef.current.dispose();
    modelRef.current = createModel();
    trainingDataRef.current = [];
    setAiDataCount(0);

    setS4Round(1);
    setS4Params(randomParams());
    setS4Prediction(null);
    setS4AiPrediction(null);
    setS4Scores({ student: 0, ai: 0 });
    setS4Results([]);
    setLandedData(null);
    setS4Phase('predict');
  }, []);

  /* ── 단계 전환 시 상태 초기화 ── */
  useEffect(() => {
    setLandedData(null);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [currentStep]);

  /* ── 현재 단계의 phase 가져오기 ── */
  const currentPhase =
    currentStep === 1 ? s1Phase
    : currentStep === 2 ? s2Phase
    : currentStep === 3 ? s3Phase
    : s4Phase;

  /* ── 현재 단계의 오차 계산 ── */
  function getErrorDisplay() {
    if (!landedData) return null;
    const results = [];
    if (landedData.studentPred != null) {
      results.push({ label: '내 오차', value: Math.abs(landedData.studentPred - landedData.landingX), color: '#3B82F6' });
    }
    if (landedData.aiPred != null) {
      results.push({ label: 'AI 오차', value: Math.abs(landedData.aiPred - landedData.landingX), color: '#EF4444' });
    }
    return results;
  }

  /* ═══════════════════════════ JSX ═══════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* 상단 네비게이션 */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <Link
              to="/ai-lab"
              className="inline-flex items-center gap-1.5 text-sm no-underline transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              AI 실험실
            </Link>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(240, 136, 62, 0.1)', color: '#F0883E' }}>
              Regression
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-black mt-3"
            style={{ color: 'var(--color-text-primary)' }}>
            AI vs 나: 물리 예측
          </h1>
          <p className="text-sm mt-1 mb-3" style={{ color: 'var(--color-text-muted)' }}>
            포물선 운동의 착지점을 관찰하고, 예측하고, AI와 경쟁해보세요!
          </p>

          {/* 스텝 인디케이터 */}
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">

          {/* 단계 설명 카드 */}
          <div className="rounded-xl p-4 mb-4"
            style={{
              backgroundColor: 'var(--color-accent-bg)',
              border: '1px solid var(--color-accent)',
            }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
                <span className="text-sm font-bold">{currentStep}</span>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-1"
                  style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                  {STEPS[currentStep - 1].title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {currentStep === 1 && '각도와 속도를 바꿔서 공이 어디에 떨어지는지 관찰해보세요!'}
                  {currentStep === 2 && '이번엔 물리 법칙을 생각하며 착지점을 맞춰보세요!'}
                  {currentStep === 3 && 'AI는 매 라운드 결과를 학습하고 있어요!'}
                  {currentStep === 4 && '5라운드 동안 AI와 대결! AI의 데이터가 쌓일수록 예측이 정확해지는 것이 보이나요?'}
                </p>
              </div>
            </div>
          </div>

          {/* 캔버스 */}
          <div
            ref={containerRef}
            className="rounded-2xl overflow-hidden"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-panel)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full block"
              onClick={handleCanvasClick}
              style={{
                cursor: (currentStep >= 2 && currentPhase === 'predict') ? 'crosshair' : 'default',
                imageRendering: 'auto',
              }}
            />
          </div>

          {/* ═══════ Step 1: 슬라이더 + 발사 ═══════ */}
          {currentStep === 1 && (
            <div className="mt-4 space-y-4">
              {/* 슬라이더 패널 */}
              <div className="rounded-xl p-5"
                style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* 각도 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        발사 각도
                      </label>
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>
                        {s1Angle}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20} max={70} value={s1Angle}
                      onChange={e => { setS1Angle(Number(e.target.value)); if (s1Phase === 'landed') handleStep1Reset(); }}
                      disabled={s1Phase === 'animating'}
                      className="w-full accent-[#6366F1]"
                    />
                    <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      <span>20°</span><span>70°</span>
                    </div>
                  </div>
                  {/* 속도 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        초기 속도
                      </label>
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}>
                        {s1Velocity} m/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15} max={40} value={s1Velocity}
                      onChange={e => { setS1Velocity(Number(e.target.value)); if (s1Phase === 'landed') handleStep1Reset(); }}
                      disabled={s1Phase === 'animating'}
                      className="w-full accent-[#F59E0B]"
                    />
                    <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      <span>15 m/s</span><span>40 m/s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 버튼 + 진행상황 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStep1Launch}
                    disabled={s1Phase === 'animating'}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <LaunchIcon size={16} />
                    발사!
                  </button>
                  {s1Phase === 'landed' && (
                    <button onClick={handleStep1Reset} className="btn-secondary inline-flex items-center gap-2">
                      <ResetIcon size={14} />
                      초기화
                    </button>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  발사 {s1Launches}회 / 각도 {s1UsedAngles.size}종
                  {s1Launches >= 3 && s1UsedAngles.size >= 2
                    ? <span style={{ color: 'var(--color-success)', marginLeft: 8, fontWeight: 600 }}>완료!</span>
                    : <span style={{ marginLeft: 8 }}>(3회 + 2종 각도 필요)</span>
                  }
                </div>
              </div>

              {/* 착지 결과 */}
              {landedData && s1Phase === 'landed' && (
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>각도:</span>{' '}
                      <span className="font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>{landedData.angle}°</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>속도:</span>{' '}
                      <span className="font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>{landedData.velocity} m/s</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>착지 거리:</span>{' '}
                      <span className="font-mono font-bold" style={{ color: '#22C55E' }}>{landedData.landingX.toFixed(1)}m</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ Step 2: 내가 예측 ═══════ */}
          {currentStep === 2 && (
            <div className="mt-4 space-y-4">
              {/* 파라미터 표시 */}
              <div className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>각도:</span>{' '}
                    <span className="font-mono font-bold" style={{ color: '#6366F1' }}>{s2Params.angle}°</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>속도:</span>{' '}
                    <span className="font-mono font-bold" style={{ color: '#F59E0B' }}>{s2Params.velocity} m/s</span>
                  </div>
                  <div className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    예측 {s2Predictions}회 {s2Predictions >= 3
                      ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}> 완료!</span>
                      : <span> (3회 필요)</span>}
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex items-center justify-center gap-3">
                {s2Phase === 'predict' && (
                  <div className="text-sm py-2 px-4 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg-panel)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    캔버스의 지면을 클릭하여 착지 지점을 예측하세요
                  </div>
                )}
                {s2Phase === 'predicted' && (
                  <button onClick={handleStep2Launch} className="btn-primary inline-flex items-center gap-2">
                    <LaunchIcon size={16} />
                    발사!
                  </button>
                )}
                {s2Phase === 'animating' && (
                  <div className="text-sm py-2 px-4 rounded-lg flex items-center gap-2"
                    style={{ backgroundColor: 'var(--color-bg-panel)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#F59E0B' }} />
                    비행 중...
                  </div>
                )}
                {s2Phase === 'result' && (
                  <button onClick={handleStep2Next} className="btn-secondary inline-flex items-center gap-2">
                    다음 예측
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 결과 */}
              {s2Phase === 'result' && landedData && (
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>내 예측</div>
                      <div className="font-mono font-bold" style={{ color: '#3B82F6' }}>
                        {landedData.studentPred.toFixed(1)}m
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>실제 착지점</div>
                      <div className="font-mono font-bold" style={{ color: '#22C55E' }}>
                        {landedData.landingX.toFixed(1)}m
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>오차</div>
                      <div className="font-mono font-bold" style={{ color: '#F59E0B' }}>
                        {Math.abs(landedData.studentPred - landedData.landingX).toFixed(1)}m
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ Step 3: AI 등장 ═══════ */}
          {currentStep === 3 && (
            <div className="mt-4 space-y-4">
              {/* 파라미터 + 스코어 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--color-text-muted)' }}>발사 조건</div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>각도:</span>{' '}
                      <span className="font-mono font-bold" style={{ color: '#6366F1' }}>{s3Params.angle}°</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>속도:</span>{' '}
                      <span className="font-mono font-bold" style={{ color: '#F59E0B' }}>{s3Params.velocity} m/s</span>
                    </div>
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    라운드 {s3Rounds}회 {s3Rounds >= 3
                      ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}> 완료!</span>
                      : <span> (3회 필요)</span>}
                  </div>
                </div>
                {/* 스코어보드 */}
                <div className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--color-text-muted)' }}>스코어보드</div>
                  <div className="flex items-stretch gap-3">
                    <div className="flex-1 rounded-lg p-2 text-center"
                      style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#3B82F6' }}>나</div>
                      <div className="font-display text-2xl font-black" style={{ color: '#3B82F6' }}>{s3Scores.student}</div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>VS</span>
                    </div>
                    <div className="flex-1 rounded-lg p-2 text-center"
                      style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>AI</div>
                      <div className="font-display text-2xl font-black" style={{ color: '#EF4444' }}>{s3Scores.ai}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI 학습 상태 */}
              <div className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-4">
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    AI 학습 데이터: <span className="font-mono" style={{ color: 'var(--color-text-primary)' }}>{aiDataCount}개</span>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, aiDataCount * 15)}%`,
                        backgroundColor: aiDataCount < 3 ? '#EF4444' : aiDataCount < 5 ? '#F59E0B' : '#22C55E',
                      }} />
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    AI는 매 라운드 결과를 학습하고 있어요!
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex items-center justify-center gap-3">
                {s3Phase === 'predict' && (
                  <div className="text-sm py-2 px-4 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg-panel)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    캔버스의 지면을 클릭하여 착지 지점을 예측하세요
                  </div>
                )}
                {s3Phase === 'predicted' && (
                  <button onClick={handleStep3Launch} className="btn-primary inline-flex items-center gap-2">
                    <LaunchIcon size={16} />
                    발사!
                  </button>
                )}
                {s3Phase === 'animating' && (
                  <div className="text-sm py-2 px-4 rounded-lg flex items-center gap-2"
                    style={{ backgroundColor: 'var(--color-bg-panel)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#F59E0B' }} />
                    비행 중...
                  </div>
                )}
                {s3Phase === 'result' && (
                  <button onClick={handleStep3Next} className="btn-secondary inline-flex items-center gap-2">
                    다음 라운드
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 라운드 결과 */}
              {s3Phase === 'result' && landedData && (
                <div className="rounded-xl p-4"
                  style={{
                    backgroundColor: 'var(--color-bg-panel)',
                    border: `1px solid ${
                      Math.abs(landedData.studentPred - landedData.landingX) <=
                      Math.abs(landedData.aiPred - landedData.landingX)
                        ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'
                    }`,
                  }}>
                  <div className="text-center mb-3">
                    <span className="text-base font-display font-black"
                      style={{
                        color: Math.abs(landedData.studentPred - landedData.landingX) <=
                               Math.abs(landedData.aiPred - landedData.landingX) ? '#3B82F6' : '#EF4444',
                      }}>
                      {Math.abs(landedData.studentPred - landedData.landingX) <=
                       Math.abs(landedData.aiPred - landedData.landingX) ? '내가 이겼다!' : 'AI가 이겼다!'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>내 예측</div>
                      <div className="font-mono font-bold" style={{ color: '#3B82F6' }}>
                        {landedData.studentPred.toFixed(1)}m
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        (오차: {Math.abs(landedData.studentPred - landedData.landingX).toFixed(1)}m)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>실제 착지점</div>
                      <div className="font-mono font-bold" style={{ color: '#22C55E' }}>
                        {landedData.landingX.toFixed(1)}m
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>AI 예측</div>
                      <div className="font-mono font-bold" style={{ color: '#EF4444' }}>
                        {landedData.aiPred.toFixed(1)}m
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        (오차: {Math.abs(landedData.aiPred - landedData.landingX).toFixed(1)}m)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ Step 4: AI를 이겨라! ═══════ */}
          {currentStep === 4 && (
            <div className="mt-4 space-y-4">
              {s4Phase !== 'finished' && (
                <>
                  {/* 라운드 & 스코어 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl p-4"
                      style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--color-text-muted)' }}>라운드</span>
                        <span className="font-display font-black text-lg" style={{ color: 'var(--color-text-primary)' }}>
                          {s4Round} / {TOTAL_ROUNDS}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(s4Round / TOTAL_ROUNDS) * 100}%`, backgroundColor: '#F0883E' }} />
                      </div>
                      <div className="flex items-center gap-6 text-sm mt-3">
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>각도:</span>{' '}
                          <span className="font-mono font-bold" style={{ color: '#6366F1' }}>{s4Params.angle}°</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>속도:</span>{' '}
                          <span className="font-mono font-bold" style={{ color: '#F59E0B' }}>{s4Params.velocity} m/s</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl p-4"
                      style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: 'var(--color-text-muted)' }}>스코어보드</div>
                      <div className="flex items-stretch gap-3">
                        <div className="flex-1 rounded-lg p-2 text-center"
                          style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                          <div className="text-xs font-semibold" style={{ color: '#3B82F6' }}>나</div>
                          <div className="font-display text-2xl font-black" style={{ color: '#3B82F6' }}>{s4Scores.student}</div>
                        </div>
                        <div className="flex items-center">
                          <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>VS</span>
                        </div>
                        <div className="flex-1 rounded-lg p-2 text-center"
                          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>AI</div>
                          <div className="font-display text-2xl font-black" style={{ color: '#EF4444' }}>{s4Scores.ai}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div className="flex items-center justify-center gap-3">
                    {s4Phase === 'predict' && (
                      <div className="text-sm py-2 px-4 rounded-lg"
                        style={{ backgroundColor: 'var(--color-bg-panel)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        캔버스의 지면을 클릭하여 착지 지점을 예측하세요
                      </div>
                    )}
                    {s4Phase === 'predicted' && (
                      <button onClick={handleStep4Launch} className="btn-primary inline-flex items-center gap-2">
                        <LaunchIcon size={16} />
                        발사!
                      </button>
                    )}
                    {s4Phase === 'animating' && (
                      <div className="text-sm py-2 px-4 rounded-lg flex items-center gap-2"
                        style={{ backgroundColor: 'var(--color-bg-panel)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#F59E0B' }} />
                        비행 중...
                      </div>
                    )}
                    {s4Phase === 'result' && (
                      <button onClick={handleStep4Next} className="btn-primary inline-flex items-center gap-2">
                        다음 라운드
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* 라운드 결과 */}
                  {s4Phase === 'result' && landedData && (
                    <div className="rounded-xl p-4"
                      style={{
                        backgroundColor: 'var(--color-bg-panel)',
                        border: `1px solid ${
                          Math.abs(landedData.studentPred - landedData.landingX) <=
                          Math.abs(landedData.aiPred - landedData.landingX)
                            ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'
                        }`,
                      }}>
                      <div className="text-center mb-2">
                        <span className="text-base font-display font-black"
                          style={{
                            color: Math.abs(landedData.studentPred - landedData.landingX) <=
                                   Math.abs(landedData.aiPred - landedData.landingX) ? '#3B82F6' : '#EF4444',
                          }}>
                          {Math.abs(landedData.studentPred - landedData.landingX) <=
                           Math.abs(landedData.aiPred - landedData.landingX) ? '내가 이겼다!' : 'AI가 이겼다!'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>내 예측</div>
                          <div className="font-mono font-bold" style={{ color: '#3B82F6' }}>
                            {landedData.studentPred.toFixed(1)}m
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            (오차: {Math.abs(landedData.studentPred - landedData.landingX).toFixed(1)}m)
                          </div>
                        </div>
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>실제 착지점</div>
                          <div className="font-mono font-bold" style={{ color: '#22C55E' }}>
                            {landedData.landingX.toFixed(1)}m
                          </div>
                        </div>
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>AI 예측</div>
                          <div className="font-mono font-bold" style={{ color: '#EF4444' }}>
                            {landedData.aiPred.toFixed(1)}m
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            (오차: {Math.abs(landedData.aiPred - landedData.landingX).toFixed(1)}m)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══════ 최종 결과 화면 ═══════ */}
              {s4Phase === 'finished' && (
                <div className="rounded-xl p-6"
                  style={{
                    backgroundColor: 'var(--color-bg-panel)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                  }}>
                  <h2 className="font-display text-xl font-black text-center mb-2"
                    style={{ color: 'var(--color-text-primary)' }}>
                    최종 결과
                  </h2>
                  <div className="text-center mb-5">
                    <span className="text-lg font-display font-black"
                      style={{
                        color: s4Scores.student > s4Scores.ai ? '#3B82F6'
                          : s4Scores.ai > s4Scores.student ? '#EF4444'
                          : '#F59E0B',
                      }}>
                      {s4Scores.student > s4Scores.ai
                        ? '축하합니다! 당신이 AI를 이겼습니다!'
                        : s4Scores.ai > s4Scores.student
                        ? 'AI가 승리했습니다! 다시 도전해보세요.'
                        : '무승부! 인간과 AI가 동등했습니다.'}
                    </span>
                  </div>

                  {/* 점수 요약 */}
                  <div className="flex items-stretch gap-3 justify-center mb-5">
                    <div className="rounded-lg p-3 text-center min-w-[100px]"
                      style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#3B82F6' }}>나</div>
                      <div className="font-display text-3xl font-black" style={{ color: '#3B82F6' }}>{s4Scores.student}</div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>VS</span>
                    </div>
                    <div className="rounded-lg p-3 text-center min-w-[100px]"
                      style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#EF4444' }}>AI</div>
                      <div className="font-display text-3xl font-black" style={{ color: '#EF4444' }}>{s4Scores.ai}</div>
                    </div>
                  </div>

                  {/* 라운드별 결과 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <th className="py-2 px-2 text-left text-xs font-semibold"
                            style={{ color: 'var(--color-text-muted)' }}>라운드</th>
                          <th className="py-2 px-2 text-right text-xs font-semibold"
                            style={{ color: 'var(--color-text-muted)' }}>조건</th>
                          <th className="py-2 px-2 text-right text-xs font-semibold"
                            style={{ color: 'var(--color-text-muted)' }}>실제</th>
                          <th className="py-2 px-2 text-right text-xs font-semibold"
                            style={{ color: '#3B82F6' }}>내 오차</th>
                          <th className="py-2 px-2 text-right text-xs font-semibold"
                            style={{ color: '#EF4444' }}>AI 오차</th>
                          <th className="py-2 px-2 text-center text-xs font-semibold"
                            style={{ color: 'var(--color-text-muted)' }}>승자</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s4Results.map((r) => (
                          <tr key={r.round} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="py-2 px-2 font-mono">{r.round}</td>
                            <td className="py-2 px-2 text-right font-mono text-xs">
                              {r.angle}° / {r.velocity}m/s
                            </td>
                            <td className="py-2 px-2 text-right font-mono">{r.actual.toFixed(1)}m</td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: '#3B82F6' }}>
                              {r.studentDist.toFixed(1)}m
                            </td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: '#EF4444' }}>
                              {r.aiDist.toFixed(1)}m
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: r.winner === 'student' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: r.winner === 'student' ? '#3B82F6' : '#EF4444',
                                }}>
                                {r.winner === 'student' ? '나' : 'AI'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* AI 학습 인사이트 */}
                  <div className="mt-5 p-4 rounded-lg"
                    style={{ backgroundColor: 'rgba(240, 136, 62, 0.06)', border: '1px solid rgba(240, 136, 62, 0.15)' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: '#F0883E' }}>
                      AI 학습 인사이트
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      AI는 총 {aiDataCount}개의 데이터로 학습했습니다.
                      초반에는 무작위로 추측했지만, 점점 물리 법칙의 패턴을 학습했습니다.
                      이것이 바로 <strong>회귀(Regression)</strong> 학습의 핵심입니다 -- 데이터가 많아질수록 예측이 정확해집니다!
                    </p>
                    <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                      AI의 데이터가 쌓일수록 예측이 정확해지는 것이 보이나요?
                    </p>
                  </div>

                  {/* 재시작 버튼 */}
                  <div className="flex justify-center mt-5">
                    <button onClick={handleStep4Restart} className="btn-secondary inline-flex items-center gap-2">
                      <ResetIcon size={14} />
                      다시 도전하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 물리 공식 카드 (항상 표시) */}
          <div className="rounded-xl p-4 mt-6 mb-8"
            style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="var(--color-text-muted)" strokeWidth="1.5" />
                <text x="8" y="11.5" fill="var(--color-text-muted)" fontSize="10" fontWeight="bold" textAnchor="middle">?</text>
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}>
                포물선 운동 공식
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono"
              style={{ color: 'var(--color-text-secondary)' }}>
              <div className="space-y-1">
                <div>x(t) = v&#x2080; &middot; cos(&#x3B8;) &middot; t</div>
                <div>y(t) = v&#x2080; &middot; sin(&#x3B8;) &middot; t - &#xBD;gt&#xB2;</div>
              </div>
              <div className="space-y-1">
                <div>착지거리 = v&#x2080;&#xB2; &middot; sin(2&#x3B8;) / g</div>
                <div>g = 9.8 m/s&#xB2;</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 단계 전환 오버레이 */}
      {showTransition && currentStep < 4 && (
        <StepTransition
          nextStepTitle={STEPS[currentStep].title}
          onNext={dismissTransition}
        />
      )}
    </div>
  );
}
