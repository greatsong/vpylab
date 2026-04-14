import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import Header from '../../components/layout/Header';
import { playNote, playSfx } from '../../engine/sound-system';
import StepIndicator, { useStepProgress, StepTransition } from '../../components/shared/StepIndicator';
import { PlayIcon, ResetIcon, DanceIcon, StarIcon } from '../../components/shared/Icons';
import { setupHiDPICanvas } from '../../utils/canvasHiDPI';

/* ────────── 상수 ────────── */
const GRID_SIZE = 4;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const CAPTURE_SIZE = 64;
const MOTION_THRESHOLD = 30;

/* ────────── 타겟 패턴 정의 ────────── */
const PATTERNS = [
  { name: '양팔 벌려!', grid: [0,0,0,0, 1,0,0,1, 1,0,0,1, 0,0,0,0] },
  { name: '점프!', grid: [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0] },
  { name: '왼쪽으로!', grid: [0,0,0,0, 1,1,0,0, 1,1,0,0, 0,0,0,0] },
  { name: '오른쪽으로!', grid: [0,0,0,0, 0,0,1,1, 0,0,1,1, 0,0,0,0] },
  { name: '크게!', grid: [1,1,1,1, 1,0,0,1, 1,0,0,1, 1,1,1,1] },
  { name: '위로 손!', grid: [1,0,0,1, 1,0,0,1, 0,0,0,0, 0,0,0,0] },
  { name: 'X 포즈!', grid: [1,0,0,1, 0,1,1,0, 0,1,1,0, 1,0,0,1] },
  { name: '아래로!', grid: [0,0,0,0, 0,0,0,0, 1,0,0,1, 1,0,0,1] },
  { name: '가운데!', grid: [0,0,0,0, 0,1,1,0, 0,1,1,0, 0,0,0,0] },
  { name: '전부 흔들어!', grid: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
];

/* ────────── 점수 계산 ────────── */
function calcMatchPercent(motionGrid, targetGrid) {
  let match = 0;
  let total = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (targetGrid[i]) {
      total++;
      if (motionGrid[i]) match++;
    }
  }
  if (total === 0) return 100;
  return Math.round((match / total) * 100);
}

function scoreToStars(score) {
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  if (score >= 10) return 1;
  return 0;
}

/* ────────── 단계 정의 ────────── */
const STEP_DEFS = [
  { title: '거울 모드' },
  { title: '한 포즈 따라하기' },
  { title: '연속 챌린지' },
  { title: '리듬 모드' },
];

/* ────────── 서브 컴포넌트: 타겟 그리드 ────────── */
function TargetGrid({ targetGrid, motionGrid, size = 240 }) {
  return (
    <div
      className="grid gap-2 mx-auto"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        maxWidth: `${size}px`,
      }}
    >
      {targetGrid.map((cell, i) => (
        <div
          key={i}
          className="rounded-lg transition-all duration-200"
          style={{
            aspectRatio: '1',
            background: cell
              ? motionGrid[i]
                ? 'var(--color-success)'
                : 'var(--color-accent)'
              : motionGrid[i]
                ? 'rgba(255,255,255,0.1)'
                : 'var(--color-bg-primary)',
            border: cell ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
            opacity: cell ? 1 : 0.4,
            transform: cell && motionGrid[i] ? 'scale(1.05)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

/* ────────── 서브 컴포넌트: 별점 표시 ────────── */
function StarRating({ count, max = 5, size = 24 }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <StarIcon
          key={i}
          size={size}
          filled={i < count}
          className={i < count ? '' : 'opacity-30'}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PoseDance 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
export default function PoseDance() {
  const { t } = useI18n();

  /* ── 스텝 진행 ── */
  const {
    currentStep, completedSteps, showTransition,
    completeStep, goToStep, dismissTransition, isUnlocked,
  } = useStepProgress(4);

  /* ── 웹캠 & 캔버스 refs ── */
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const overlayContainerRef = useRef(null);
  const prevFrameRef = useRef(null);
  const motionGridRef = useRef(new Array(CELL_COUNT).fill(0));
  const animFrameRef = useRef(null);

  /* ── 공통 상태 ── */
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [motionGrid, setMotionGrid] = useState(new Array(CELL_COUNT).fill(0));

  /* ── Step 1 상태 ── */
  const [step1CellsActivated, setStep1CellsActivated] = useState(new Set());
  const [step1StartTime, setStep1StartTime] = useState(null);
  const [step1Elapsed, setStep1Elapsed] = useState(0);
  const step1TimerRef = useRef(null);

  /* ── Step 2 상태 ── */
  const [step2PatternIdx, setStep2PatternIdx] = useState(0);
  const [step2Matched, setStep2Matched] = useState(0);
  const [step2MatchPercent, setStep2MatchPercent] = useState(0);
  const [step2Active, setStep2Active] = useState(false);

  /* ── Step 3 상태 ── */
  const [step3Phase, setStep3Phase] = useState('idle'); // idle | countdown | playing | result
  const [step3Countdown, setStep3Countdown] = useState(3);
  const [step3PatternIdx, setStep3PatternIdx] = useState(0);
  const [step3Score, setStep3Score] = useState(0);
  const [step3TimeLeft, setStep3TimeLeft] = useState(100);
  const [step3PatternResult, setStep3PatternResult] = useState(null);
  const [step3Stars, setStep3Stars] = useState(0);
  const step3TimerRef = useRef(null);
  const step3CountdownRef = useRef(null);

  /* ── Step 4 상태 ── */
  const [step4Phase, setStep4Phase] = useState('idle'); // idle | countdown | playing | result
  const [step4Countdown, setStep4Countdown] = useState(3);
  const [step4PatternIdx, setStep4PatternIdx] = useState(0);
  const [step4Score, setStep4Score] = useState(0);
  const [step4Combo, setStep4Combo] = useState(0);
  const [step4TimeLeft, setStep4TimeLeft] = useState(100);
  const [step4PatternResult, setStep4PatternResult] = useState(null);
  const [step4Stars, setStep4Stars] = useState(0);
  const step4TimerRef = useRef(null);
  const step4CountdownRef = useRef(null);

  /* ── 카메라 시작/중지 ── */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setCameraError(null);
      }
    } catch (err) {
      console.error('카메라 접근 실패:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? '카메라 접근이 거부되었습니다. 브라우저 설정에서 허용해주세요.'
          : '카메라를 사용할 수 없습니다. 다른 프로그램이 카메라를 사용 중일 수 있습니다.'
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((tr) => tr.stop());
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  /* ── 오버레이 그리기 (HiDPI) ── */
  const drawOverlay = useCallback((grid) => {
    const canvas = overlayCanvasRef.current;
    const container = overlayContainerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const logW = Math.round(rect.width);
    const logH = Math.round(rect.height);
    if (logW === 0 || logH === 0) return;

    const ctx = setupHiDPICanvas(canvas, logW, logH);
    ctx.clearRect(0, 0, logW, logH);

    const cellW = logW / GRID_SIZE;
    const cellH = logH / GRID_SIZE;

    for (let i = 0; i < CELL_COUNT; i++) {
      if (grid[i]) {
        const gx = i % GRID_SIZE;
        const gy = Math.floor(i / GRID_SIZE);
        ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
        ctx.fillRect(gx * cellW, gy * cellH, cellW, cellH);
      }
    }

    // 그리드 라인
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, logH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(logW, i * cellH);
      ctx.stroke();
    }
  }, []);

  /* ── 모션 감지 루프 ── */
  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectMotion);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;

    // 좌우반전 (거울 모드)
    ctx.translate(CAPTURE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const currentFrame = ctx.getImageData(0, 0, CAPTURE_SIZE, CAPTURE_SIZE).data;
    const prevFrame = prevFrameRef.current;

    if (prevFrame) {
      const cellSize = CAPTURE_SIZE / GRID_SIZE;
      const grid = new Array(CELL_COUNT).fill(0);
      const motionCounts = new Array(CELL_COUNT).fill(0);

      for (let y = 0; y < CAPTURE_SIZE; y++) {
        for (let x = 0; x < CAPTURE_SIZE; x++) {
          const idx = (y * CAPTURE_SIZE + x) * 4;
          const diff =
            Math.abs(currentFrame[idx] - prevFrame[idx]) +
            Math.abs(currentFrame[idx + 1] - prevFrame[idx + 1]) +
            Math.abs(currentFrame[idx + 2] - prevFrame[idx + 2]);

          if (diff > MOTION_THRESHOLD) {
            const gx = Math.min(Math.floor(x / cellSize), GRID_SIZE - 1);
            const gy = Math.min(Math.floor(y / cellSize), GRID_SIZE - 1);
            motionCounts[gy * GRID_SIZE + gx]++;
          }
        }
      }

      const cellPixels = cellSize * cellSize;
      const activeThreshold = cellPixels * 0.1;
      for (let i = 0; i < CELL_COUNT; i++) {
        grid[i] = motionCounts[i] > activeThreshold ? 1 : 0;
      }

      motionGridRef.current = grid;
      setMotionGrid([...grid]);
      drawOverlay(grid);
    }

    prevFrameRef.current = new Uint8ClampedArray(currentFrame);
    animFrameRef.current = requestAnimationFrame(detectMotion);
  }, [drawOverlay]);

  /* ── 마운트 / 언마운트 ── */
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(step1TimerRef.current);
      clearInterval(step3TimerRef.current);
      clearInterval(step3CountdownRef.current);
      clearInterval(step4TimerRef.current);
      clearInterval(step4CountdownRef.current);
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (cameraReady) {
      animFrameRef.current = requestAnimationFrame(detectMotion);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraReady, detectMotion]);

  /* ══════════════════════════════════════════════════
     Step 1: 거울 모드 — 10초 동안 8칸 이상 누적 활성화
     ══════════════════════════════════════════════════ */
  useEffect(() => {
    if (currentStep !== 1 || !cameraReady) return;

    // 활성화된 셀 누적 추적
    const newSet = new Set(step1CellsActivated);
    motionGrid.forEach((v, i) => {
      if (v) newSet.add(i);
    });
    if (newSet.size !== step1CellsActivated.size) {
      setStep1CellsActivated(newSet);
    }

    // 처음 움직임 감지 시 타이머 시작
    if (newSet.size > 0 && !step1StartTime) {
      setStep1StartTime(Date.now());
    }
  }, [motionGrid, currentStep, cameraReady, step1CellsActivated, step1StartTime]);

  useEffect(() => {
    if (!step1StartTime || currentStep !== 1) return;
    step1TimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - step1StartTime) / 1000);
      setStep1Elapsed(elapsed);
      if (elapsed >= 10 && step1CellsActivated.size >= 8) {
        clearInterval(step1TimerRef.current);
        completeStep(1);
      }
    }, 500);
    return () => clearInterval(step1TimerRef.current);
  }, [step1StartTime, currentStep, step1CellsActivated, completeStep]);

  /* ══════════════════════════════════════════════════
     Step 2: 한 포즈 따라하기 — 3개 패턴 70%+ 매칭
     ══════════════════════════════════════════════════ */
  const step2Pattern = useMemo(() => PATTERNS[step2PatternIdx % PATTERNS.length], [step2PatternIdx]);

  useEffect(() => {
    if (currentStep !== 2 || !step2Active) return;
    const pct = calcMatchPercent(motionGrid, step2Pattern.grid);
    setStep2MatchPercent(pct);
  }, [motionGrid, currentStep, step2Active, step2Pattern]);

  const handleStep2Start = useCallback(() => {
    setStep2Active(true);
    setStep2PatternIdx(0);
    setStep2Matched(0);
    setStep2MatchPercent(0);
  }, []);

  const handleStep2Next = useCallback(() => {
    if (step2MatchPercent < 70) return;
    playSfx('coin');
    const newMatched = step2Matched + 1;
    setStep2Matched(newMatched);
    if (newMatched >= 3) {
      setStep2Active(false);
      completeStep(2);
    } else {
      setStep2PatternIdx((prev) => prev + 1);
      setStep2MatchPercent(0);
    }
  }, [step2MatchPercent, step2Matched, completeStep]);

  /* ══════════════════════════════════════════════════
     Step 3: 연속 챌린지 — 5 패턴, 3.5초씩, 별점
     ══════════════════════════════════════════════════ */
  const STEP3_TOTAL = 5;
  const STEP3_DURATION = 3500;

  const startStep3 = useCallback(() => {
    setStep3Phase('countdown');
    setStep3Score(0);
    setStep3PatternIdx(0);
    setStep3PatternResult(null);
    setStep3Stars(0);
    setStep3Countdown(3);

    let c = 3;
    step3CountdownRef.current = setInterval(() => {
      c--;
      setStep3Countdown(c);
      playNote('C4', 0.1);
      if (c <= 0) {
        clearInterval(step3CountdownRef.current);
        beginStep3Pattern(0, 0);
      }
    }, 1000);
  }, []);

  const beginStep3Pattern = useCallback((idx, currentScore) => {
    if (idx >= STEP3_TOTAL) {
      const avgScore = Math.round(currentScore / STEP3_TOTAL);
      const stars = scoreToStars(avgScore);
      setStep3Phase('result');
      setStep3Score(currentScore);
      setStep3Stars(stars);
      playSfx('success');
      completeStep(3);
      return;
    }

    setStep3Phase('playing');
    setStep3PatternIdx(idx);
    setStep3PatternResult(null);
    setStep3TimeLeft(100);
    playNote('E4', 0.15);

    const startTime = Date.now();
    step3TimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / STEP3_DURATION) * 100);
      setStep3TimeLeft(remaining);

      if (elapsed >= STEP3_DURATION) {
        clearInterval(step3TimerRef.current);
        const pattern = PATTERNS[idx % PATTERNS.length];
        const pScore = calcMatchPercent(motionGridRef.current, pattern.grid);
        const isGood = pScore >= 50;
        const earned = isGood ? pScore : 0;
        const newScore = currentScore + earned;

        setStep3Score(newScore);
        setStep3PatternResult({ score: pScore, earned, good: isGood });

        if (isGood) playSfx('coin');
        else playSfx('fail');

        setTimeout(() => beginStep3Pattern(idx + 1, newScore), 1200);
      }
    }, 50);
  }, [completeStep]);

  const resetStep3 = useCallback(() => {
    clearInterval(step3TimerRef.current);
    clearInterval(step3CountdownRef.current);
    setStep3Phase('idle');
    setStep3Score(0);
    setStep3PatternIdx(0);
    setStep3PatternResult(null);
  }, []);

  /* ══════════════════════════════════════════════════
     Step 4: 리듬 모드 — 10 패턴 + 콤보 + 사운드
     ══════════════════════════════════════════════════ */
  const STEP4_TOTAL = 10;
  const STEP4_DURATION = 3500;

  const startStep4 = useCallback(() => {
    setStep4Phase('countdown');
    setStep4Score(0);
    setStep4Combo(0);
    setStep4PatternIdx(0);
    setStep4PatternResult(null);
    setStep4Stars(0);
    setStep4Countdown(3);

    let c = 3;
    step4CountdownRef.current = setInterval(() => {
      c--;
      setStep4Countdown(c);
      playNote('C4', 0.1);
      if (c <= 0) {
        clearInterval(step4CountdownRef.current);
        beginStep4Pattern(0, 0, 0);
      }
    }, 1000);
  }, []);

  const beginStep4Pattern = useCallback((idx, currentScore, currentCombo) => {
    if (idx >= STEP4_TOTAL) {
      const stars = scoreToStars(Math.min(100, Math.round(currentScore / STEP4_TOTAL)));
      setStep4Phase('result');
      setStep4Score(currentScore);
      setStep4Stars(stars);
      playSfx('success');
      completeStep(4);
      return;
    }

    setStep4Phase('playing');
    setStep4PatternIdx(idx);
    setStep4PatternResult(null);
    setStep4TimeLeft(100);

    // 비트 표시 사운드
    const notes = ['C4', 'E4', 'G4', 'C5'];
    playNote(notes[idx % notes.length], 0.15);

    const startTime = Date.now();
    step4TimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / STEP4_DURATION) * 100);
      setStep4TimeLeft(remaining);

      if (elapsed >= STEP4_DURATION) {
        clearInterval(step4TimerRef.current);
        const pattern = PATTERNS[idx % PATTERNS.length];
        const pScore = calcMatchPercent(motionGridRef.current, pattern.grid);
        const isGood = pScore >= 50;
        const newCombo = isGood ? currentCombo + 1 : 0;
        const comboMultiplier = Math.min(1 + newCombo * 0.5, 5);
        const earned = isGood ? Math.round(pScore * comboMultiplier) : 0;
        const newScore = currentScore + earned;

        setStep4Score(newScore);
        setStep4Combo(newCombo);
        setStep4PatternResult({ score: pScore, earned, good: isGood });

        if (isGood) playSfx('coin');
        else playSfx('fail');

        setTimeout(() => beginStep4Pattern(idx + 1, newScore, newCombo), 1200);
      }
    }, 50);
  }, [completeStep]);

  const resetStep4 = useCallback(() => {
    clearInterval(step4TimerRef.current);
    clearInterval(step4CountdownRef.current);
    setStep4Phase('idle');
    setStep4Score(0);
    setStep4Combo(0);
    setStep4PatternIdx(0);
    setStep4PatternResult(null);
  }, []);

  /* ── 현재 단계에 따른 패턴 ── */
  const activePattern = useMemo(() => {
    if (currentStep === 2) return step2Pattern;
    if (currentStep === 3) return PATTERNS[step3PatternIdx % PATTERNS.length];
    if (currentStep === 4) return PATTERNS[step4PatternIdx % PATTERNS.length];
    return null;
  }, [currentStep, step2Pattern, step3PatternIdx, step4PatternIdx]);

  /* ── 렌더링 ── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Header />
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-12">
        {/* 상단 네비게이션 + 제목 */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            to="/ai-lab"
            className="flex items-center gap-1 text-sm transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z"/>
            </svg>
            AI 실험실
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            AI 댄스 파티
          </h1>
          <span
            className="ml-2 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-accent)', color: '#fff', opacity: 0.85 }}
          >
            Motion Detection
          </span>
        </div>

        {/* 스텝 표시기 */}
        <StepIndicator
          steps={STEP_DEFS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />

        {/* 카메라 에러 */}
        {cameraError && (
          <div
            className="rounded-xl p-4 mb-6 text-sm"
            style={{ background: 'var(--color-error)', color: '#fff', opacity: 0.9 }}
          >
            {cameraError}
            <button
              className="ml-3 underline text-white"
              onClick={() => { setCameraError(null); startCamera(); }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-4">

          {/* 왼쪽: 웹캠 + 오버레이 */}
          <div
            ref={overlayContainerRef}
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              aspectRatio: '4/3',
            }}
          >
            {!cameraReady && !cameraError && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <div className="text-center">
                  <div
                    className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3"
                    style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
                  />
                  <p className="text-sm">카메라 연결 중...</p>
                </div>
              </div>
            )}

            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Step 3/4 카운트다운 */}
            {((currentStep === 3 && step3Phase === 'countdown') ||
              (currentStep === 4 && step4Phase === 'countdown')) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span
                  className="text-8xl font-bold animate-pulse"
                  style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}
                >
                  {currentStep === 3 ? step3Countdown : step4Countdown}
                </span>
              </div>
            )}

            {/* Step 3/4 패턴 점수 플래시 */}
            {((currentStep === 3 && step3PatternResult) ||
              (currentStep === 4 && step4PatternResult)) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="text-center px-6 py-4 rounded-2xl"
                  style={{
                    background: (currentStep === 3 ? step3PatternResult : step4PatternResult).good
                      ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)',
                    animation: 'fadeInScale 0.3s ease-out',
                  }}
                >
                  <div className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {(currentStep === 3 ? step3PatternResult : step4PatternResult).good
                      ? `+${(currentStep === 3 ? step3PatternResult : step4PatternResult).earned}`
                      : 'MISS'}
                  </div>
                  <div className="text-sm text-white/80">
                    일치율 {(currentStep === 3 ? step3PatternResult : step4PatternResult).score}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 단계별 패널 */}
          <div
            className="rounded-2xl p-6 flex flex-col items-center justify-center"
            style={{
              background: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              minHeight: '280px',
            }}
          >
            {/* ═══ Step 1: 거울 모드 ═══ */}
            {currentStep === 1 && (
              <div className="text-center w-full">
                <DanceIcon size={48} className="mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  거울 모드
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  움직여보세요! 초록색 영역이 움직임이 감지된 곳이에요.
                </p>

                {/* 진행 상황 */}
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    <span>활성화 영역: {step1CellsActivated.size} / 8</span>
                    <span>경과 시간: {step1Elapsed}s / 10s</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (step1CellsActivated.size / 8) * 50 + (step1Elapsed / 10) * 50)}%`,
                        background: 'var(--color-accent)',
                      }}
                    />
                  </div>
                </div>

                {/* 4x4 셀 활성화 미니맵 */}
                <div
                  className="grid gap-1 mx-auto mb-4"
                  style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: '160px' }}
                >
                  {Array.from({ length: CELL_COUNT }, (_, i) => (
                    <div
                      key={i}
                      className="rounded transition-all duration-200"
                      style={{
                        aspectRatio: '1',
                        background: motionGrid[i]
                          ? 'var(--color-success)'
                          : step1CellsActivated.has(i)
                            ? 'rgba(0,184,148,0.2)'
                            : 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border)',
                      }}
                    />
                  ))}
                </div>

                {completedSteps.has(1) && (
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                    완료! 다양한 위치에서 움직임을 감지했습니다.
                  </p>
                )}
              </div>
            )}

            {/* ═══ Step 2: 한 포즈 따라하기 ═══ */}
            {currentStep === 2 && (
              <div className="text-center w-full">
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  한 포즈 따라하기
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  오른쪽 패턴과 같은 위치에서 움직여보세요!
                </p>

                {!step2Active && !completedSteps.has(2) && (
                  <button className="btn-primary inline-flex items-center gap-2" onClick={handleStep2Start}>
                    <PlayIcon size={14} />
                    시작하기
                  </button>
                )}

                {step2Active && (
                  <>
                    <p
                      className="text-lg font-bold mb-3"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                    >
                      {step2Pattern.name}
                    </p>

                    <TargetGrid targetGrid={step2Pattern.grid} motionGrid={motionGrid} />

                    {/* 일치율 */}
                    <div className="mt-4 mb-3">
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        <span>일치율</span>
                        <span>{step2MatchPercent}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${step2MatchPercent}%`,
                            background: step2MatchPercent >= 70 ? 'var(--color-success)' : 'var(--color-accent)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        성공: {step2Matched} / 3
                      </span>
                      <button
                        className="btn-primary inline-flex items-center gap-2 text-sm"
                        disabled={step2MatchPercent < 70}
                        onClick={handleStep2Next}
                      >
                        다음 포즈
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}

                {completedSteps.has(2) && !step2Active && (
                  <p className="text-sm font-semibold mt-2" style={{ color: 'var(--color-success)' }}>
                    3개 패턴 매칭 성공!
                  </p>
                )}
              </div>
            )}

            {/* ═══ Step 3: 연속 챌린지 ═══ */}
            {currentStep === 3 && (
              <div className="text-center w-full">
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  연속 챌린지
                </h2>

                {step3Phase === 'idle' && (
                  <>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                      5개 패턴이 3.5초 간격으로 나옵니다. 빠르게 따라하세요!
                    </p>
                    <button className="btn-primary inline-flex items-center gap-2" onClick={startStep3}>
                      <PlayIcon size={14} />
                      도전 시작
                    </button>
                  </>
                )}

                {step3Phase === 'countdown' && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    준비하세요!
                  </p>
                )}

                {step3Phase === 'playing' && (
                  <>
                    <p
                      className="text-lg font-bold mb-3"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                    >
                      {PATTERNS[step3PatternIdx % PATTERNS.length].name}
                    </p>

                    <TargetGrid
                      targetGrid={PATTERNS[step3PatternIdx % PATTERNS.length].grid}
                      motionGrid={motionGrid}
                    />

                    {/* 타이머 바 */}
                    <div className="w-full h-2 rounded-full overflow-hidden mt-4 mb-2" style={{ background: 'var(--color-bg-primary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-100"
                        style={{
                          width: `${step3TimeLeft}%`,
                          background: step3TimeLeft > 30 ? 'var(--color-accent)' : 'var(--color-error)',
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span>점수: {step3Score}</span>
                      <span>{step3PatternIdx + 1} / {STEP3_TOTAL}</span>
                    </div>
                  </>
                )}

                {step3Phase === 'result' && (
                  <>
                    <div className="mb-3 flex justify-center" style={{ color: 'var(--color-accent)' }}>
                      <StarRating count={step3Stars} size={32} />
                    </div>
                    <div
                      className="text-4xl font-bold mb-2"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                    >
                      {step3Score}
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      {step3Stars >= 4 ? '훌륭해요!' : step3Stars >= 2 ? '잘했어요! 다시 해볼까요?' : '다시 도전해보세요!'}
                    </p>
                    <button className="btn-secondary inline-flex items-center gap-2" onClick={() => { resetStep3(); startStep3(); }}>
                      <ResetIcon size={14} />
                      다시 도전
                    </button>
                  </>
                )}

                {(step3Phase === 'playing' || step3Phase === 'countdown') && (
                  <button className="btn-secondary inline-flex items-center gap-2 mt-3 text-sm" onClick={resetStep3}>
                    <ResetIcon size={14} />
                    초기화
                  </button>
                )}
              </div>
            )}

            {/* ═══ Step 4: 리듬 모드 ═══ */}
            {currentStep === 4 && (
              <div className="text-center w-full">
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  리듬 모드
                </h2>

                {step4Phase === 'idle' && (
                  <>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                      10개 패턴 + 콤보 보너스! 리듬에 맞춰 움직이세요!
                    </p>
                    <button className="btn-primary inline-flex items-center gap-2" onClick={startStep4}>
                      <DanceIcon size={18} />
                      리듬 시작
                    </button>
                  </>
                )}

                {step4Phase === 'countdown' && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    준비하세요!
                  </p>
                )}

                {step4Phase === 'playing' && (
                  <>
                    <p
                      className="text-lg font-bold mb-3"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                    >
                      {PATTERNS[step4PatternIdx % PATTERNS.length].name}
                    </p>

                    <TargetGrid
                      targetGrid={PATTERNS[step4PatternIdx % PATTERNS.length].grid}
                      motionGrid={motionGrid}
                    />

                    {/* 타이머 바 */}
                    <div className="w-full h-2 rounded-full overflow-hidden mt-4 mb-2" style={{ background: 'var(--color-bg-primary)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-100"
                        style={{
                          width: `${step4TimeLeft}%`,
                          background: step4TimeLeft > 30 ? 'var(--color-accent)' : 'var(--color-error)',
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span>점수: {step4Score}</span>
                      <span>{step4PatternIdx + 1} / {STEP4_TOTAL}</span>
                    </div>

                    {step4Combo > 0 && (
                      <div
                        className="inline-block text-xs font-bold px-3 py-1 rounded-full mt-2"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        콤보 x{step4Combo}
                      </div>
                    )}
                  </>
                )}

                {step4Phase === 'result' && (
                  <>
                    <div className="mb-3 flex justify-center" style={{ color: 'var(--color-accent)' }}>
                      <StarRating count={step4Stars} size={32} />
                    </div>
                    <div
                      className="text-4xl font-bold mb-2"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                    >
                      {step4Score}
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      {step4Stars >= 4
                        ? '최고의 댄서! 환상적이에요!'
                        : step4Stars >= 2
                          ? '잘했어요! 조금만 더 연습하면 완벽해요!'
                          : '괜찮아요! 연습하면 늘어요!'}
                    </p>
                    <button className="btn-primary inline-flex items-center gap-2" onClick={() => { resetStep4(); startStep4(); }}>
                      <DanceIcon size={18} />
                      다시 도전
                    </button>
                  </>
                )}

                {(step4Phase === 'playing' || step4Phase === 'countdown') && (
                  <button className="btn-secondary inline-flex items-center gap-2 mt-3 text-sm" onClick={resetStep4}>
                    <ResetIcon size={14} />
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 설명 카드 — Step 1에서는 프레임 차분 설명, 나머지는 간략 설명 */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3
            className="text-sm font-bold mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            어떻게 동작하나요?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <div>
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>1. 프레임 차분</span>
              <p className="mt-1">이전 프레임과 현재 프레임의 픽셀 차이를 계산하여 움직임을 감지합니다.</p>
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>2. 영역 분할</span>
              <p className="mt-1">화면을 4x4(16칸) 그리드로 나누어 각 영역의 움직임 강도를 측정합니다.</p>
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>3. 패턴 매칭</span>
              <p className="mt-1">타겟 패턴과 움직임 영역의 일치율을 점수로 계산합니다.</p>
            </div>
          </div>
        </div>
      </main>

      {/* 스텝 전환 오버레이 */}
      {showTransition && currentStep < 4 && (
        <StepTransition
          nextStepTitle={STEP_DEFS[currentStep]?.title || ''}
          onNext={dismissTransition}
        />
      )}

      {/* 애니메이션 키프레임 */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-accent-rgb, 99,102,241), 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(var(--color-accent-rgb, 99,102,241), 0); }
        }
      `}</style>
    </div>
  );
}
