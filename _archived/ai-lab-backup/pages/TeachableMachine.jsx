import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import { useI18n } from '../../i18n';
import Header from '../../components/layout/Header';
import StepIndicator, { useStepProgress, StepTransition } from '../../components/shared/StepIndicator';
import { CameraIcon, TrainIcon, ResetIcon, PlayIcon } from '../../components/shared/Icons';
import { setupHiDPICanvas } from '../../utils/canvasHiDPI';

/* ────────── 상수 ────────── */
const IMG_SIZE = 64;
const FEATURE_DIM = IMG_SIZE * IMG_SIZE; // 그레이스케일 4096
const EPOCHS = 10;
const BATCH_SIZE = 16;
const MIN_SAMPLES = 5;
const OBSERVE_SECONDS = 5;

const CLASS_COLORS = ['var(--brand-coral)', 'var(--brand-cyan)', '#A78BFA'];
const CLASS_COLORS_HEX = ['#FF6B6B', '#00CEC9', '#A78BFA'];
const CLASS_COLORS_RGB = [
  [255, 107, 107], // brand-coral
  [0, 206, 201],   // brand-cyan
  [167, 139, 250], // purple (3rd class)
];
const DEFAULT_LABELS_2 = ['클래스 1', '클래스 2'];
const DEFAULT_LABELS_3 = ['클래스 1', '클래스 2', '클래스 3'];

const STEPS = [
  { title: '데이터 수집' },
  { title: '학습시키기' },
  { title: '테스트해보기' },
  { title: '3번째 클래스 추가' },
];

/* ────────── 헬퍼: 웹캠 프레임 -> 그레이스케일 특성 벡터 ────────── */
function captureGrayscale(video, canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  ctx.drawImage(video, 0, 0, IMG_SIZE, IMG_SIZE);
  const imageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
  const data = new Float32Array(FEATURE_DIM);
  for (let i = 0; i < FEATURE_DIM; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    data[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return data;
}

/* ────────── 모델 생성 ────────── */
function createModel(numClasses) {
  const model = tf.sequential();
  model.add(tf.layers.dense({
    inputShape: [FEATURE_DIM],
    units: 64,
    activation: 'relu',
  }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

/* ────────── 3D 구 캔버스 그리기 ────────── */
function drawSphere(canvas, rgb, rotation) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.32;

  // 구 본체
  const grad = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.05,
    cx, cy, radius,
  );
  const [r, g, b] = rgb;
  grad.addColorStop(0, `rgba(${Math.min(r + 80, 255)}, ${Math.min(g + 80, 255)}, ${Math.min(b + 80, 255)}, 1)`);
  grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(1, `rgba(${Math.max(r - 60, 0)}, ${Math.max(g - 60, 0)}, ${Math.max(b - 60, 0)}, 1)`);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 하이라이트 반사
  const hlGrad = ctx.createRadialGradient(
    cx - radius * 0.25, cy - radius * 0.25, 0,
    cx - radius * 0.25, cy - radius * 0.25, radius * 0.6,
  );
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = hlGrad;
  ctx.fill();

  // 회전 줄무늬
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.07;
  const stripeCount = 6;
  for (let i = 0; i < stripeCount; i++) {
    const offset = ((rotation + i / stripeCount) % 1) * radius * 2 - radius;
    ctx.beginPath();
    ctx.moveTo(cx + offset - 3, cy - radius);
    ctx.lineTo(cx + offset + 3, cy - radius);
    ctx.lineTo(cx + offset + 1, cy + radius);
    ctx.lineTo(cx + offset - 1, cy + radius);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();

  // 그림자
  const shadowGrad = ctx.createRadialGradient(cx, cy + radius * 1.2, 0, cx, cy + radius * 1.2, radius * 0.7);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 1.2, radius * 0.7, radius * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadowGrad;
  ctx.fill();
}

/* ═══════════════════════════════════════════════════════════════
   TeachableMachine 컴포넌트 (4-Step Scaffolding)
   ═══════════════════════════════════════════════════════════════ */
export default function TeachableMachine() {
  const { t } = useI18n();

  /* ── 스텝 진행 ── */
  const {
    currentStep, completedSteps, showTransition,
    completeStep, goToStep, dismissTransition, isUnlocked,
  } = useStepProgress(4);

  /* ── 상태 ── */
  const [numClasses, setNumClasses] = useState(2);
  const [labels, setLabels] = useState([...DEFAULT_LABELS_2]);
  const [sampleCounts, setSampleCounts] = useState([0, 0]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainProgress, setTrainProgress] = useState(null);
  const [isTrained, setIsTrained] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [trainError, setTrainError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(-1);
  const [observeTimer, setObserveTimer] = useState(0);
  const [showThirdClass, setShowThirdClass] = useState(false);

  /* ── refs ── */
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const sphereCanvasRef = useRef(null);
  const samplesRef = useRef([[], []]);
  const modelRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const predictionRafRef = useRef(null);
  const sphereColorRef = useRef([136, 136, 136]);
  const sphereTargetRef = useRef([136, 136, 136]);
  const sphereRotRef = useRef(0);
  const sphereAnimRef = useRef(null);
  const mountedRef = useRef(true);
  const observeTimerRef = useRef(null);
  const numClassesRef = useRef(2);

  // numClasses ref 동기화
  useEffect(() => { numClassesRef.current = numClasses; }, [numClasses]);

  /* ────────── 웹캠 시작 ────────── */
  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        if (!cancelled) setCameraError(err.message || t('aiLab.cameraPermission'));
      }
    }
    startCamera();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ────────── 3D 구 애니메이션 ────────── */
  useEffect(() => {
    const canvas = sphereCanvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function animate() {
      sphereAnimRef.current = requestAnimationFrame(animate);
      const cur = sphereColorRef.current;
      const tgt = sphereTargetRef.current;
      for (let i = 0; i < 3; i++) {
        cur[i] += (tgt[i] - cur[i]) * 0.06;
      }
      sphereRotRef.current = (sphereRotRef.current + 0.003) % 1;
      drawSphere(canvas, cur, sphereRotRef.current);
    }
    animate();

    return () => {
      cancelAnimationFrame(sphereAnimRef.current);
      ro.disconnect();
    };
  }, []);

  /* ────────── 클린업 ────────── */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      clearInterval(captureIntervalRef.current);
      clearInterval(observeTimerRef.current);
      cancelAnimationFrame(predictionRafRef.current);
      cancelAnimationFrame(sphereAnimRef.current);
      modelRef.current?.dispose();
    };
  }, []);

  /* ────────── Step 1 완료 조건 체크 ────────── */
  useEffect(() => {
    if (currentStep === 1 && !completedSteps.has(1)) {
      const requiredClasses = numClasses === 2
        ? sampleCounts.slice(0, 2)
        : sampleCounts;
      const allReady = requiredClasses.every((c) => c >= MIN_SAMPLES);
      if (allReady) {
        completeStep(1);
      }
    }
  }, [sampleCounts, currentStep, completedSteps, completeStep, numClasses]);

  /* ────────── 샘플 캡처 ────────── */
  const startCapture = useCallback((classIdx) => {
    if (!cameraReady || isTraining) return;
    setIsCapturing(classIdx);
    const capture = () => {
      if (!videoRef.current || !captureCanvasRef.current) return;
      const data = captureGrayscale(videoRef.current, captureCanvasRef.current);
      samplesRef.current[classIdx].push(data);
      setSampleCounts((prev) => {
        const next = [...prev];
        next[classIdx] = samplesRef.current[classIdx].length;
        return next;
      });
    };
    capture();
    captureIntervalRef.current = setInterval(capture, 100);
  }, [cameraReady, isTraining]);

  const stopCapture = useCallback(() => {
    clearInterval(captureIntervalRef.current);
    setIsCapturing(-1);
  }, []);

  /* ────────── 학습 ────────── */
  const handleTrain = useCallback(async () => {
    const nc = numClassesRef.current;
    setIsTraining(true);
    setTrainError(null);
    setTrainProgress(null);
    setIsTrained(false);
    setPredictions(null);
    setObserveTimer(0);
    clearInterval(observeTimerRef.current);

    modelRef.current?.dispose();

    try {
      const model = createModel(nc);
      modelRef.current = model;

      const xs = [];
      const ys = [];
      for (let c = 0; c < nc; c++) {
        for (const sample of samplesRef.current[c]) {
          xs.push(sample);
          const label = new Float32Array(nc);
          label[c] = 1;
          ys.push(label);
        }
      }

      const xTensor = tf.tensor2d(xs, [xs.length, FEATURE_DIM]);
      const yTensor = tf.tensor2d(ys, [ys.length, nc]);

      await model.fit(xTensor, yTensor, {
        epochs: EPOCHS,
        batchSize: BATCH_SIZE,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (mountedRef.current) {
              setTrainProgress({
                epoch: epoch + 1,
                loss: logs.loss.toFixed(4),
                acc: (logs.acc * 100).toFixed(1),
              });
            }
          },
        },
      });

      xTensor.dispose();
      yTensor.dispose();

      if (mountedRef.current) {
        setIsTrained(true);
        setIsTraining(false);
        completeStep(2);
        startPredictionLoop(nc);
      }
    } catch (err) {
      if (mountedRef.current) {
        setTrainError(err.message || '학습 중 오류가 발생했습니다.');
        setIsTraining(false);
      }
    }
  }, [completeStep]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ────────── 실시간 예측 루프 ────────── */
  const startPredictionLoop = useCallback((nc) => {
    cancelAnimationFrame(predictionRafRef.current);

    function loop() {
      if (!mountedRef.current || !modelRef.current || !videoRef.current || !captureCanvasRef.current) return;
      predictionRafRef.current = requestAnimationFrame(loop);

      const data = captureGrayscale(videoRef.current, captureCanvasRef.current);
      const input = tf.tensor2d([data], [1, FEATURE_DIM]);
      const pred = modelRef.current.predict(input);
      const values = pred.dataSync();
      input.dispose();
      pred.dispose();

      setPredictions(new Float32Array(values));

      const maxIdx = values.indexOf(Math.max(...values));
      sphereTargetRef.current = [...CLASS_COLORS_RGB[maxIdx]];
    }
    loop();
  }, []);

  /* ────────── Step 3 관찰 타이머 ────────── */
  useEffect(() => {
    if (currentStep === 3 && isTrained && !completedSteps.has(3)) {
      clearInterval(observeTimerRef.current);
      setObserveTimer(0);
      let elapsed = 0;
      observeTimerRef.current = setInterval(() => {
        elapsed += 1;
        setObserveTimer(elapsed);
        if (elapsed >= OBSERVE_SECONDS) {
          clearInterval(observeTimerRef.current);
          completeStep(3);
        }
      }, 1000);
      return () => clearInterval(observeTimerRef.current);
    }
  }, [currentStep, isTrained, completedSteps, completeStep]);

  /* ────────── Step 4: 3번째 클래스 추가 ────────── */
  useEffect(() => {
    if (currentStep === 4 && !showThirdClass) {
      setShowThirdClass(true);
      setNumClasses(3);
      setLabels((prev) => [...prev, '클래스 3']);
      setSampleCounts((prev) => [...prev, 0]);
      samplesRef.current.push([]);
      // 기존 모델 해제 — 3클래스로 재학습 필요
      cancelAnimationFrame(predictionRafRef.current);
      modelRef.current?.dispose();
      modelRef.current = null;
      setIsTrained(false);
      setPredictions(null);
      setTrainProgress(null);
      sphereTargetRef.current = [136, 136, 136];
    }
  }, [currentStep, showThirdClass]);

  /* ────────── 초기화 ────────── */
  const handleReset = useCallback(() => {
    cancelAnimationFrame(predictionRafRef.current);
    clearInterval(observeTimerRef.current);
    modelRef.current?.dispose();
    modelRef.current = null;
    samplesRef.current = [[], []];
    setNumClasses(2);
    setSampleCounts([0, 0]);
    setIsTrained(false);
    setPredictions(null);
    setTrainProgress(null);
    setTrainError(null);
    setIsTraining(false);
    setLabels([...DEFAULT_LABELS_2]);
    setObserveTimer(0);
    setShowThirdClass(false);
    sphereTargetRef.current = [136, 136, 136];
  }, []);

  /* ────────── 재학습 (Step 4) ────────── */
  const handleRetrain = useCallback(async () => {
    // Step 4에서 3클래스 재학습
    await handleTrain();
  }, [handleTrain]);

  /* ────────── 라벨 변경 ────────── */
  const updateLabel = (idx, value) => {
    setLabels((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  /* ────────── 파생 값 ────────── */
  const activeClasses = currentStep >= 4 ? numClasses : 2;
  const canTrain = sampleCounts.slice(0, activeClasses).every((c) => c >= MIN_SAMPLES) && !isTraining;
  const bestIdx = predictions ? [...predictions].indexOf(Math.max(...predictions)) : -1;

  /* ═══════════════════════════════════════════
     렌더링
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* 네비게이션 & 제목 */}
        <Link
          to="/ai-lab"
          className="inline-flex items-center gap-1 text-sm font-semibold no-underline mb-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-accent)' }}
        >
          {t('aiLab.back')}
        </Link>

        <div className="mb-6">
          <h1
            className="font-display text-2xl md:text-3xl font-black mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {t('aiLab.teachable.title')}
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            {t('aiLab.teachable.desc')}
          </p>
        </div>

        {/* ── 스텝 표시기 ── */}
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />

        {/* ── 스텝 전환 오버레이 ── */}
        {showTransition && currentStep < 4 && (
          <StepTransition
            nextStepTitle={STEPS[currentStep]?.title}
            onNext={dismissTransition}
          />
        )}
        {showTransition && currentStep === 4 && (
          <StepTransition
            nextStepTitle={STEPS[3].title}
            onNext={dismissTransition}
          />
        )}

        {/* ── 상단: 웹캠 + 3D 프리뷰 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-4">
          {/* 웹캠 */}
          <div
            className="relative overflow-hidden aspect-video"
            style={{
              backgroundColor: '#000',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <CameraIcon size={40} className="opacity-50" style={{ color: 'var(--color-error)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
                  {t('aiLab.cameraPermission')}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  브라우저 설정에서 카메라 접근을 허용해주세요.
                </p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}

            {/* 캡처 중 표시 */}
            {isCapturing >= 0 && (
              <div
                className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: CLASS_COLORS_HEX[isCapturing],
                  color: '#fff',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              >
                촬영 중 ({sampleCounts[isCapturing]})
              </div>
            )}
          </div>

          {/* 오프스크린 캔버스 */}
          <canvas ref={captureCanvasRef} className="hidden" />

          {/* 3D 프리뷰 */}
          <div
            className="relative overflow-hidden aspect-video"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <canvas
              ref={sphereCanvasRef}
              className="w-full h-full"
              style={{ display: 'block' }}
            />
            {!isTrained && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.12)', pointerEvents: 'none' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  학습 후 예측 결과에 따라 색상이 변합니다
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════
           Step 1: 데이터 수집
           ═══════════════════════════════════════ */}
        {currentStep === 1 && (
          <div
            className="p-5 md:p-6 mb-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              데이터 수집
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              웹캠 앞에서 두 가지 다른 포즈를 보여주세요! 각 클래스 버튼을 길게 누르면 웹캠에서 프레임을 수집합니다.
              클래스별 최소 {MIN_SAMPLES}개 이상의 샘플이 필요합니다.
            </p>

            <div className="flex flex-col gap-4">
              {labels.slice(0, 2).map((label, idx) => (
                <ClassRow
                  key={idx}
                  idx={idx}
                  label={label}
                  sampleCount={sampleCounts[idx]}
                  color={CLASS_COLORS_HEX[idx]}
                  isCapturing={isCapturing === idx}
                  disabled={!cameraReady || isTraining || isTrained}
                  onLabelChange={(v) => updateLabel(idx, v)}
                  onStartCapture={() => startCapture(idx)}
                  onStopCapture={stopCapture}
                />
              ))}
            </div>

            {/* 완료 안내 */}
            {sampleCounts[0] >= MIN_SAMPLES && sampleCounts[1] >= MIN_SAMPLES && (
              <div
                className="mt-4 px-4 py-3 rounded-xl text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(0, 184, 148, 0.08)',
                  border: '1px solid rgba(0, 184, 148, 0.3)',
                  color: 'var(--color-success)',
                }}
              >
                두 클래스 모두 충분한 데이터를 모았습니다. 다음 단계로 진행하세요!
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
           Step 2: 학습시키기
           ═══════════════════════════════════════ */}
        {currentStep === 2 && (
          <div
            className="p-5 md:p-6 mb-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              학습시키기
            </h3>

            {/* 설명 카드 */}
            <div
              className="text-xs mb-5 px-4 py-3 rounded-xl"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.7,
              }}
            >
              AI가 두 포즈의 차이를 학습하고 있어요. 에폭(epoch)이 반복될수록 정확해집니다.
              10번의 에폭을 거치면 학습이 완료됩니다.
            </div>

            {/* 학습 시작 버튼 */}
            {!isTrained && !isTraining && (
              <button
                onClick={handleTrain}
                disabled={!canTrain}
                className="btn-primary w-full inline-flex items-center justify-center gap-2 h-12 text-sm font-bold"
                style={{
                  opacity: canTrain ? 1 : 0.4,
                  cursor: canTrain ? 'pointer' : 'not-allowed',
                }}
              >
                <TrainIcon size={18} />
                학습 시작
              </button>
            )}

            {/* 학습 진행률 */}
            {trainProgress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-bold">
                    에폭 {trainProgress.epoch}/{EPOCHS}
                  </span>
                  <span className="font-mono">
                    정확도 {trainProgress.acc}% / 손실 {trainProgress.loss}
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden"
                  style={{ backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)' }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(trainProgress.epoch / EPOCHS) * 100}%`,
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
                </div>
                {isTrained && (
                  <p className="text-xs mt-3 font-semibold" style={{ color: 'var(--color-success)' }}>
                    학습 완료! 다음 단계에서 테스트해보세요.
                  </p>
                )}
              </div>
            )}

            {/* 학습 에러 */}
            {trainError && (
              <div
                className="mt-4 px-4 py-3 text-xs rounded-xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                  border: '1px solid var(--color-error)',
                  color: 'var(--color-error)',
                }}
              >
                {trainError}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
           Step 3: 테스트해보기
           ═══════════════════════════════════════ */}
        {currentStep === 3 && (
          <div
            className="p-5 md:p-6 mb-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              테스트해보기
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              웹캠 앞에서 포즈를 바꿔보세요! AI가 구분하나요?
            </p>

            {/* 관찰 타이머 */}
            {!completedSteps.has(3) && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>관찰 진행 중...</span>
                  <span className="font-mono">{observeTimer}/{OBSERVE_SECONDS}초</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden"
                  style={{ backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)' }}
                >
                  <div
                    className="h-full transition-all duration-1000"
                    style={{
                      width: `${(observeTimer / OBSERVE_SECONDS) * 100}%`,
                      backgroundColor: 'var(--color-success)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 예측 결과 바 */}
            {predictions ? (
              <div className="flex flex-col gap-3">
                {labels.slice(0, activeClasses).map((label, idx) => {
                  const conf = predictions[idx] || 0;
                  const pct = (conf * 100).toFixed(1);
                  const isBest = idx === bestIdx;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className="font-semibold"
                          style={{ color: isBest ? CLASS_COLORS_HEX[idx] : 'var(--color-text-secondary)' }}
                        >
                          {label}
                        </span>
                        <span
                          className="font-mono"
                          style={{ color: isBest ? CLASS_COLORS_HEX[idx] : 'var(--color-text-muted)' }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div
                        className="h-3 overflow-hidden"
                        style={{ backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)' }}
                      >
                        <div
                          className="h-full transition-all duration-150"
                          style={{
                            width: `${Math.max(conf * 100, 0.5)}%`,
                            backgroundColor: CLASS_COLORS_HEX[idx],
                            borderRadius: 'var(--radius-md)',
                            opacity: isBest ? 1 : 0.35,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="mt-3 pt-3 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>현재 예측</p>
                  <p
                    className="font-display text-xl font-black mt-1"
                    style={{ color: bestIdx >= 0 ? CLASS_COLORS_HEX[bestIdx] : 'var(--color-text-primary)' }}
                  >
                    {bestIdx >= 0 ? labels[bestIdx] : '--'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  예측을 준비하고 있습니다...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
           Step 4: 3번째 클래스 추가
           ═══════════════════════════════════════ */}
        {currentStep === 4 && (
          <div
            className="p-5 md:p-6 mb-6"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              3번째 클래스 추가
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              새로운 포즈를 추가하고 3가지를 구분하도록 재학습시켜 보세요. 자유롭게 실험하세요!
            </p>

            {/* 기존 클래스 요약 + 새 클래스 */}
            <div className="flex flex-col gap-4">
              {labels.map((label, idx) => (
                <div
                  key={idx}
                  className={idx === 2 ? 'animate-slide-up' : ''}
                >
                  <ClassRow
                    idx={idx}
                    label={label}
                    sampleCount={sampleCounts[idx]}
                    color={CLASS_COLORS_HEX[idx]}
                    isCapturing={isCapturing === idx}
                    disabled={!cameraReady || isTraining}
                    onLabelChange={(v) => updateLabel(idx, v)}
                    onStartCapture={() => startCapture(idx)}
                    onStopCapture={stopCapture}
                    highlight={idx === 2}
                  />
                </div>
              ))}
            </div>

            {/* 재학습 / 리셋 버튼 */}
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={handleRetrain}
                disabled={!canTrain}
                className="btn-primary flex-1 inline-flex items-center justify-center gap-2 h-12 text-sm font-bold"
                style={{
                  opacity: canTrain ? 1 : 0.4,
                  cursor: canTrain ? 'pointer' : 'not-allowed',
                }}
              >
                <TrainIcon size={18} />
                {isTraining ? '학습 중...' : '재학습'}
              </button>

              <button
                onClick={handleReset}
                disabled={isTraining}
                className="btn-secondary inline-flex items-center justify-center gap-2 h-12 px-5 text-sm font-bold"
                style={{
                  opacity: isTraining ? 0.4 : 1,
                  cursor: isTraining ? 'not-allowed' : 'pointer',
                }}
              >
                <ResetIcon size={16} />
                초기화
              </button>
            </div>

            {/* 학습 진행률 (Step 4) */}
            {trainProgress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-bold">에폭 {trainProgress.epoch}/{EPOCHS}</span>
                  <span className="font-mono">정확도 {trainProgress.acc}% / 손실 {trainProgress.loss}</span>
                </div>
                <div
                  className="h-3 overflow-hidden"
                  style={{ backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)' }}
                >
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(trainProgress.epoch / EPOCHS) * 100}%`,
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* 학습 에러 (Step 4) */}
            {trainError && (
              <div
                className="mt-4 px-4 py-3 text-xs rounded-xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                  border: '1px solid var(--color-error)',
                  color: 'var(--color-error)',
                }}
              >
                {trainError}
              </div>
            )}

            {/* Step 4 예측 결과 */}
            {isTrained && predictions && (
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
                <h4 className="text-xs font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  실시간 예측 결과
                </h4>
                <div className="flex flex-col gap-3">
                  {labels.map((label, idx) => {
                    const conf = predictions[idx] || 0;
                    const pct = (conf * 100).toFixed(1);
                    const isBest = idx === bestIdx;
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span
                            className="font-semibold"
                            style={{ color: isBest ? CLASS_COLORS_HEX[idx] : 'var(--color-text-secondary)' }}
                          >
                            {label}
                          </span>
                          <span
                            className="font-mono"
                            style={{ color: isBest ? CLASS_COLORS_HEX[idx] : 'var(--color-text-muted)' }}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div
                          className="h-3 overflow-hidden"
                          style={{ backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-md)' }}
                        >
                          <div
                            className="h-full transition-all duration-150"
                            style={{
                              width: `${Math.max(conf * 100, 0.5)}%`,
                              backgroundColor: CLASS_COLORS_HEX[idx],
                              borderRadius: 'var(--radius-md)',
                              opacity: isBest ? 1 : 0.35,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-2 pt-3 text-center" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>현재 예측</p>
                    <p
                      className="font-display text-xl font-black mt-1"
                      style={{ color: bestIdx >= 0 ? CLASS_COLORS_HEX[bestIdx] : 'var(--color-text-primary)' }}
                    >
                      {bestIdx >= 0 ? labels[bestIdx] : '--'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 모델 구조 정보 (항상 표시) ── */}
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            모델 구조
          </h3>
          <div className="flex flex-col gap-1.5 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex justify-between">
              <span>입력</span>
              <span>{IMG_SIZE}x{IMG_SIZE} 그레이스케일 = {FEATURE_DIM}개 특성</span>
            </div>
            <div style={{ borderBottom: '1px dashed var(--color-border)' }} />
            <div className="flex justify-between">
              <span>은닉층</span>
              <span>Dense(64, ReLU) + Dropout(0.25)</span>
            </div>
            <div style={{ borderBottom: '1px dashed var(--color-border)' }} />
            <div className="flex justify-between">
              <span>출력</span>
              <span>Dense({numClasses}, Softmax)</span>
            </div>
            <div style={{ borderBottom: '1px dashed var(--color-border)' }} />
            <div className="flex justify-between">
              <span>클래스 수</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>{numClasses}개</span>
            </div>
            <div style={{ borderBottom: '1px dashed var(--color-border)' }} />
            <div className="flex justify-between">
              <span>총 샘플</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {sampleCounts.reduce((a, b) => a + b, 0)}장
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* slide-up 애니메이션 */}
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ClassRow — 클래스 한 줄 (라벨 + 캡처 버튼 + 샘플 바)
   ═══════════════════════════════════════════════════════════════ */
function ClassRow({
  idx, label, sampleCount, color, isCapturing,
  disabled, onLabelChange, onStartCapture, onStopCapture, highlight = false,
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={highlight ? {
        padding: '12px',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${color}`,
        backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
      } : {}}
    >
      {/* 색상 인디케이터 */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* 라벨 입력 */}
      <input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        disabled={disabled}
        className="flex-1 min-w-0 text-sm px-3 py-2 font-mono outline-none transition-colors"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-primary)',
        }}
        onFocus={(e) => { e.target.style.borderColor = color; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
      />

      {/* 캡처 버튼 */}
      <button
        onMouseDown={onStartCapture}
        onMouseUp={onStopCapture}
        onMouseLeave={onStopCapture}
        onTouchStart={(e) => { e.preventDefault(); onStartCapture(); }}
        onTouchEnd={onStopCapture}
        disabled={disabled}
        className="h-12 px-4 inline-flex items-center gap-2 text-xs font-bold transition-all select-none shrink-0"
        style={{
          backgroundColor: color,
          color: '#fff',
          borderRadius: 'var(--radius-lg)',
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...(isCapturing ? { animation: 'pulse 1.5s ease-in-out infinite', transform: 'scale(0.97)' } : {}),
        }}
      >
        <CameraIcon size={18} />
        촬영
      </button>

      {/* 샘플 수 바 */}
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <div
          className="flex-1 h-2.5 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${Math.min((sampleCount / (MIN_SAMPLES * 3)) * 100, 100)}%`,
              backgroundColor: color,
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
        <span
          className="text-xs font-mono w-8 text-right tabular-nums"
          style={{
            color: sampleCount >= MIN_SAMPLES
              ? 'var(--color-success)'
              : 'var(--color-text-muted)',
            fontWeight: sampleCount >= MIN_SAMPLES ? 700 : 400,
          }}
        >
          {sampleCount}
        </span>
      </div>
    </div>
  );
}
