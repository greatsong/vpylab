import { Component, useCallback, useEffect, useRef, useState } from 'react';
import Viewport3D from '../components/viewport/Viewport3D';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { ensureAudioResumed, stopAllSounds, resumeAndRun } from '../engine/sound-system';

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

/** 수업의 AI 사용 정책과 관계없이 같은 Python·3D 실행 환경을 제공합니다. */
export default function RuntimePanel({ code, onRunResult }) {
  const sceneRef = useRef(null);
  const mountedRef = useRef(false);
  const activeRunRef = useRef(null);
  const outputRef = useRef([]);
  const outputIdRef = useRef(0);
  const [outputs, setOutputs] = useState([]);
  const [lastError, setLastError] = useState('');
  const [sceneReady, setSceneReady] = useState(false);

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
      setLastError('');
      addOutput('Python 실행 환경이 준비되었습니다.', 'success');
    },
    onError: (error) => {
      stopAllSounds();
      setLastError(error);
      addOutput(error, 'error');
      finishRun('error', error);
    },
    onDone: ({ stopped } = {}) => {
      stopAllSounds();
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
      stopAllSounds();
      if (scene) clearScene(scene);
      clearRegistry();
    };
  }, [initWorker]);

  const handleSceneReady = useCallback(() => { setSceneReady(true); }, []);

  const handleRun = () => {
    if (!isReady || !sceneReady) return;
    ensureAudioResumed();
    resumeAndRun(() => {
      if (!mountedRef.current || activeRunRef.current) return;
      stopAllSounds();
      if (sceneRef.current) clearScene(sceneRef.current);
      clearRegistry();
      sceneRef.current?._cameraSystem?.onCodeStart();
      outputRef.current = [];
      setOutputs([]);
      setLastError('');
      activeRunRef.current = { code, startedAt: Date.now() };
      const runId = runCode(code);
      if (!runId) activeRunRef.current = null;
      else addOutput('코드를 실행합니다. 결과를 관찰해 보세요.');
    });
  };

  const handleStop = () => {
    stopAllSounds();
    stopExecution();
    addOutput('실행 종료를 요청했습니다. 종료를 확인한 뒤 다시 실행할 수 있습니다.', 'warning');
  };

  return (
    <section className="classroom-runtime" aria-label="Python 실행과 3D 실험">
      <div className="runtime-toolbar">
        <span className={`runtime-status runtime-status--${status}`} role="status">{STATUS_LABELS[status] || STATUS_LABELS.idle}</span>
        <div className="runtime-actions">
          <button type="button" className="primary" onClick={handleRun} disabled={!isReady || !sceneReady}>▶ 실행</button>
          <button type="button" onClick={handleStop} disabled={!isRunning}>■ 정지</button>
          {(status === 'error' || status === 'idle') && <button type="button" onClick={() => { setLastError(''); void initWorker(); }}>엔진 다시 준비</button>}
        </div>
      </div>
      {status === 'loading' && <div className="runtime-progress"><progress value={progress} max="100" aria-label="Python 준비 진행률" /><span>{progressMessage}</span></div>}
      {isStopping && <p className="runtime-progress">반복문이 응답하지 않으면 실행 환경을 새로 준비합니다.</p>}
      {lastError && <p className="runtime-error" role="alert">{lastError}</p>}
      <div className="runtime-viewport" style={{ minHeight: 320 }}>
        <ViewportBoundary><Viewport3D sceneRef={sceneRef} onSceneReady={handleSceneReady} /></ViewportBoundary>
      </div>
      <div className="runtime-console">
        <div className="runtime-console-header"><strong>실행 기록</strong><span>최근 200줄</span><button type="button" onClick={() => { outputRef.current = []; setOutputs([]); }}>기록 비우기</button></div>
        <pre className="runtime-console-output" aria-label="실행 출력" tabIndex={0}>{outputs.length ? outputs.map((entry) => <span key={entry.id} className={`runtime-line runtime-line--${entry.type}`}>{entry.text}{'\n'}</span>) : '코드를 실행하면 출력과 오류를 이곳에서 확인할 수 있습니다.'}</pre>
      </div>
    </section>
  );
}
