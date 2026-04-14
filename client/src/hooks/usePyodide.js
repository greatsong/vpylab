import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessCode } from '../engine/code-preprocessor';
import vpythonApiRaw from '../engine/vpython-api.py?raw';

/**
 * Pyodide Worker 관리 훅
 *
 * - Worker 생성/종료
 * - 코드 전처리 + 실행
 * - 진행률 추적
 * - 타임아웃 (Worker.terminate() 기반)
 */
export default function usePyodide({ onOutput, onError, onBatch, onReady, onDone }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | running | error
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const workerRef = useRef(null);
  const timeoutRef = useRef(null);

  const EXECUTION_TIMEOUT = 10_000; // 10초 무응답 시 타임아웃 (활동 있으면 리셋)

  /**
   * Worker 초기화
   */
  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    setStatus('loading');
    setProgress(0);

    const worker = new Worker(
      new URL('../engine/pyodide-worker.js', import.meta.url),
      { type: 'classic' }
    );

    worker.onmessage = (e) => {
      let msg = e.data;

      // Python(vpython-api.py)에서 JSON 문자열로 보낸 경우 파싱
      if (typeof msg === 'string') {
        try {
          msg = JSON.parse(msg);
        } catch {
          return; // 파싱 불가능하면 무시
        }
      }

      const { type, ...data } = msg;

      // 활동 감지: Worker에서 메시지가 올 때마다 타임아웃 리셋
      // rate() 호출마다 batch가 오므로 무한 루프 시뮬레이션도 동작함
      if (type === 'batch' || type === 'stdout' || type === 'stderr') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            stopExecution();
            onError?.('실행 시간 초과 (10초 무응답). 무한 루프에 rate()가 있는지 확인하세요.');
          }, EXECUTION_TIMEOUT);
        }
      }

      switch (type) {
        case 'progress':
          setProgress(data.percent);
          setProgressMessage(data.message);
          break;

        case 'ready':
          setStatus('ready');
          setProgress(100);
          onReady?.();
          break;

        case 'stdout':
          onOutput?.(data.text);
          break;

        case 'stderr':
          onOutput?.(data.text, 'error');
          break;

        case 'error':
          setStatus((prev) => prev === 'loading' ? 'error' : 'ready');
          onError?.(data.error);
          break;

        case 'done':
          clearTimeout(timeoutRef.current);
          setStatus('ready');
          onDone?.();
          break;

        case 'batch':
          // Worker에서 온 커맨드 배치 → Three.js 브릿지로 전달
          if (data.commands) {
            onBatch?.(data.commands);
          }
          break;

        default:
          break;
      }
    };

    worker.onerror = (err) => {
      setStatus('error');
      onError?.(`Worker 오류: ${err.message}`);
    };

    // VPython API 코드를 함께 전송
    worker.postMessage({
      type: 'init',
      vpythonApi: vpythonApiRaw,
    });

    workerRef.current = worker;
  }, [onOutput, onError, onBatch, onReady]);

  /**
   * 코드 실행
   */
  const runCode = useCallback((rawCode) => {
    if (!workerRef.current || status !== 'ready') return;

    // 코드 전처리 (rate() → await rate() 등)
    const { code, warnings } = preprocessCode(rawCode);

    // 경고 출력
    if (warnings.length > 0) {
      warnings.forEach(w => onOutput?.(`⚠️ ${w}`, 'warning'));
    }

    setStatus('running');

    // 타임아웃 설정 — 10초간 아무 응답 없으면 강제 종료
    // rate() 호출 시 batch 메시지가 오므로 타이머가 리셋됨
    timeoutRef.current = setTimeout(() => {
      stopExecution();
      onError?.('실행 시간 초과 (10초 무응답). 무한 루프에 rate()가 있는지 확인하세요.');
    }, EXECUTION_TIMEOUT);

    workerRef.current.postMessage({ type: 'run', code });
  }, [status, onOutput, onError]);

  /**
   * 실행 중지 (Worker 강제 종료 + 재생성)
   */
  const stopExecution = useCallback(() => {
    clearTimeout(timeoutRef.current);

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setStatus('idle');

    // 새 Worker 즉시 생성 (다음 실행을 위해)
    // 약간의 딜레이 후 재초기화
    setTimeout(() => initWorker(), 100);
  }, [initWorker]);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    status,
    progress,
    progressMessage,
    initWorker,
    runCode,
    stopExecution,
    isLoading: status === 'loading',
    isReady: status === 'ready',
    isRunning: status === 'running',
  };
}
