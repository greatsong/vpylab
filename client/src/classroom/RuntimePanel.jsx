import { Component, useCallback, useEffect, useRef, useState } from 'react';
import Viewport3D from '../components/viewport/Viewport3D';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { ensureAudioResumed, getAudioState, resumeAndRun, setMasterMuted, setMasterVolume, stopAllSounds, subscribeAudioState } from '../engine/sound-system';

const MAX_OUTPUT_LINES = 200;
const MAX_OUTPUT_CHARS = 32_768;
const STATUS_LABELS = {
  idle: '실행 환경 대기', loading: 'Python 준비 중', ready: '실행 준비 완료',
  running: '코드 실행 중', stopping: '실행 종료 확인 중', error: '실행 환경 확인 필요',
};

class ViewportBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <p className="runtime-error" role="alert">3D 화면을 열지 못했습니다. WebGL을 지원하는 브라우저에서 하드웨어 가속 설정을 확인해 주세요.</p>;
    }
    return this.props.children;
  }
}

/**
 * 오류 안내 — 파이썬 오류는 한국어 설명을 먼저, 원문 한 줄과 줄 번호를 아래에 작게 보여 줍니다.
 * 보안: 모든 문자열은 React 텍스트 노드(textContent)로만 렌더링합니다.
 */
function ErrorNotice({ error }) {
  const explanation = error.details?.explanation;
  if (!explanation) return <p className="runtime-error" role="alert">{error.message}</p>;
  const { title, explanation: body, hint, line } = explanation;
  const lineLabel = Number.isInteger(line) ? `${line}번 줄` : '';
  return (
    <div className="runtime-error runtime-error--explained" role="alert">
      <strong>{title}</strong>
      <p>{body}</p>
      {hint && <p className="runtime-error-hint">→ {hint}</p>}
      {error.details.codeLine && lineLabel && <code className="runtime-error-code">{lineLabel}: {error.details.codeLine.trim()}</code>}
      <code className="runtime-error-original">{lineLabel ? `${lineLabel} · ` : ''}{error.message}</code>
    </div>
  );
}

/** 수업의 AI 사용 정책과 관계없이 같은 Python·3D 실행 환경을 제공합니다. */
export default function RuntimePanel({ code, onRunResult, initialCameraPosition, preserveDirectionOnCenter = false }) {
  const sceneRef = useRef(null);
  const mountedRef = useRef(false);
  const activeRunRef = useRef(null);
  const outputRef = useRef([]);
  const outputIdRef = useRef(0);
  const startCancelRef = useRef(null);
  const [outputs, setOutputs] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [audio, setAudio] = useState(getAudioState);
  const [audioMessage, setAudioMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioOpen) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !audioRef.current?.contains(event.target)) setAudioOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [audioOpen]);

  useEffect(() => subscribeAudioState(setAudio), []);

  const addOutput = useCallback((value, type = 'log') => {
    const text = String(value ?? '').slice(0, MAX_OUTPUT_CHARS);
    const lines = text.split('\n').map((line) => ({ text: line.slice(0, 4096), type, id: ++outputIdRef.current }));
    let next = [...outputRef.current, ...lines].slice(-MAX_OUTPUT_LINES);
    let size = next.reduce((total, line) => total + line.text.length, 0);
    while (next.length > 1 && size > MAX_OUTPUT_CHARS) size -= next.shift().text.length;
    outputRef.current = next;
    setOutputs(next);
  }, []);

  const finishRun = useCallback((status, error) => {
    const run = activeRunRef.current;
    if (!run) return;
    activeRunRef.current = null;
    onRunResult?.({
      status, code: run.code, durationMs: Math.max(0, Date.now() - run.startedAt),
      output: outputRef.current.map(({ text, type }) => ({ text, type })),
      ...(error ? { error } : {}),
    });
  }, [onRunResult]);

  const { status, progress, progressMessage, initWorker, runCode, stopExecution, isReady, isRunning, isStopping } = usePyodide({
    onOutput: addOutput,
    onBatch: (commands) => {
      if (sceneRef.current) processBatch(commands, sceneRef.current);
    },
    onReady: () => {
      setLastError(null);
      addOutput('Python 실행 환경이 준비되었습니다.', 'success');
    },
    onError: (error, details) => {
      stopAllSounds();
      // 파이썬 오류는 입문자용 설명과 함께, 그 외(초기화·Worker)는 문자열 그대로 보여 준다.
      setLastError(details ? { message: error, details } : { message: error });
      const lineLabel = Number.isInteger(details?.line) ? `${details.line}번 줄 · ` : '';
      addOutput(`${lineLabel}${error}`, 'error');
      finishRun('error', error);
    },
    onDone: ({ stopped } = {}) => {
      // 본문이 반환돼도 예약된 음표와 자연스러운 잔향은 끝까지 들려줍니다.
      if (stopped) stopAllSounds();
      addOutput(stopped ? '실행을 종료했습니다.' : '실행을 마쳤습니다.', stopped ? 'warning' : 'success');
      finishRun(stopped ? 'stopped' : 'completed');
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    const scene = sceneRef.current;
    void initWorker();
    return () => {
      mountedRef.current = false;
      activeRunRef.current = null;
      startCancelRef.current?.();
      stopAllSounds();
      if (scene) clearScene(scene);
      clearRegistry();
    };
  }, [initWorker]);

  const handleSceneReady = useCallback(() => { setSceneReady(true); }, []);

  useEffect(() => {
    if (sceneReady) sceneRef.current?._cameraSystem?.setPreserveDirectionOnCenter?.(preserveDirectionOnCenter);
  }, [sceneReady, preserveDirectionOnCenter]);

  const handleRun = () => {
    if (!isReady || !sceneReady || isStarting || activeRunRef.current) return;
    stopAllSounds();
    setAudioMessage('');
    setIsStarting(true);
    ensureAudioResumed();
    startCancelRef.current = resumeAndRun(() => {
      if (!mountedRef.current || activeRunRef.current) return;
      setIsStarting(false);
      if (sceneRef.current) clearScene(sceneRef.current);
      clearRegistry();
      sceneRef.current?._cameraSystem?.onCodeStart();
      outputRef.current = [];
      setOutputs([]);
      setLastError(null);
      activeRunRef.current = { code, startedAt: Date.now() };
      const runId = runCode(code);
      if (!runId) activeRunRef.current = null;
      else addOutput('코드를 실행합니다. 결과를 관찰해 보세요.');
    });
  };

  const handleStop = () => {
    startCancelRef.current?.();
    setIsStarting(false);
    stopAllSounds();
    setAudioMessage('소리와 예약된 연주를 정지했습니다.');
    if (isRunning) {
      stopExecution();
      addOutput('실행 종료를 요청했습니다. 종료를 확인한 뒤 다시 실행할 수 있습니다.', 'warning');
    } else addOutput('소리와 예약된 연주를 정지했습니다.');
  };

  const handleVolume = (event) => {
    const volume = Number(event.target.value) / 100;
    if (volume === 0) {
      startCancelRef.current?.();
      setIsStarting(false);
    }
    setMasterVolume(volume);
  };

  const audioLabel = audio.muted ? '음소거 중' : audio.playing ? '소리 재생 중' : `음량 ${Math.round(audio.volume * 100)}%`;
  return (
    <section className="classroom-runtime" aria-label="Python 실행과 3D 실험">
      <div className="runtime-toolbar">
        <span className={`runtime-status runtime-status--${status}`} role="status">{STATUS_LABELS[status] || STATUS_LABELS.idle}</span>
        <div className="runtime-actions">
          <button type="button" className="primary" onClick={handleRun} disabled={!isReady || !sceneReady || isStarting}>▶ 실행</button>
          <button type="button" onClick={handleStop} disabled={!isRunning && !audio.playing && !isStarting}>■ 정지</button>
          {(status === 'error' || status === 'idle') && <button type="button" onClick={() => { setLastError(null); void initWorker(); }}>엔진 다시 준비</button>}
          <div className="runtime-audio" ref={audioRef}>
            <button type="button" aria-expanded={audioOpen} aria-controls="runtime-audio-popover" title={audioLabel} onClick={() => setAudioOpen((open) => !open)}>{audio.muted ? '🔇' : '♪'} 소리</button>
            {audioOpen && <div className="runtime-audio-popover" id="runtime-audio-popover" role="group" aria-label="소리 설정">
              <strong>소리 설정 <span>{audioLabel}</span></strong>
              <div className="runtime-audio-controls">
                <label><span>음량</span><input aria-label="소리 음량" type="range" min="0" max="100" step="1" value={Math.round(audio.volume * 100)} onChange={handleVolume} /><output>{Math.round(audio.volume * 100)}%</output></label>
                <button type="button" aria-pressed={audio.muted} onClick={() => { if (!audio.muted) { startCancelRef.current?.(); setIsStarting(false); } setMasterMuted(!audio.muted); setAudioMessage(audio.muted ? '음소거를 해제했습니다.' : '음소거했습니다. 예약된 연주도 정지했습니다.'); }}>{audio.muted ? '소리 켜기' : '음소거'}</button>
              </div>
              {audioMessage && <p className="runtime-audio-message" aria-live="polite">{audioMessage}</p>}
            </div>}
          </div>
        </div>
      </div>
      {status === 'loading' && <div className="runtime-progress"><progress value={progress} max="100" aria-label="Python 준비 진행률" /><span>{progressMessage}</span></div>}
      {isStopping && <p className="runtime-progress">반복문이 응답하지 않으면 실행 환경을 새로 준비합니다.</p>}
      {lastError && <ErrorNotice error={lastError} />}
      <div className="runtime-viewport" style={{ minHeight: 320 }}>
        <ViewportBoundary><Viewport3D sceneRef={sceneRef} onSceneReady={handleSceneReady} initialCameraPosition={initialCameraPosition} /></ViewportBoundary>
      </div>
      <div className="runtime-console">
        <div className="runtime-console-header"><strong>실행 기록</strong><span>최근 200줄</span><button type="button" onClick={() => { outputRef.current = []; setOutputs([]); }}>기록 비우기</button></div>
        <pre className="runtime-console-output" aria-label="실행 출력" tabIndex={0}>{outputs.length ? outputs.map((entry) => <span key={entry.id} className={`runtime-line runtime-line--${entry.type}`}>{entry.text}{'\n'}</span>) : '코드를 실행하면 출력과 오류를 이곳에서 확인할 수 있습니다.'}</pre>
      </div>
    </section>
  );
}
