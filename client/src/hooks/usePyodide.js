import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessCode } from '../engine/code-preprocessor';
import * as singleton from '../engine/pyodide-singleton';

/**
 * Pyodide Worker 관리 훅 (싱글톤 기반)
 *
 * - 전역 Worker 1개를 공유하여 페이지 이동 시 재로딩 없음
 * - 소프트 스톱(rate 기반 중단) 우선, 실패 시 하드 스톱(terminate)
 * - micropip은 필요할 때만 지연 로딩
 */
export default function usePyodide({ onOutput, onError, onBatch, onReady, onDone }) {
  const [status, setStatus] = useState(singleton.getStatus());
  const [progress, setProgress] = useState(singleton.getStatus() === 'ready' ? 100 : 0);
  const [progressMessage, setProgressMessage] = useState('');
  const hardStopTimerRef = useRef(null);
  const activityTimerRef = useRef(null);
  const unsubRef = useRef(null);

  const ACTIVITY_TIMEOUT = 10_000; // 10초 무응답 시 타임아웃

  // 콜백 refs (최신 값 유지)
  const cbRef = useRef({ onOutput, onError, onBatch, onReady, onDone });
  cbRef.current = { onOutput, onError, onBatch, onReady, onDone };

  /**
   * Worker 메시지 핸들러
   */
  const handleMessage = useCallback((msg) => {
    const { type, ...data } = msg;
    const cb = cbRef.current;

    // 활동 감지: batch/stdout/stderr 시 타임아웃 리셋
    if (type === 'batch' || type === 'stdout' || type === 'stderr') {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
        activityTimerRef.current = setTimeout(() => {
          stopExecution();
          cb.onError?.('실행 시간 초과 (10초 무응답). 무한 루프에 rate()가 있는지 확인하세요.');
        }, ACTIVITY_TIMEOUT);
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
        cb.onReady?.();
        break;

      case 'stdout':
        cb.onOutput?.(data.text);
        break;

      case 'stderr':
        cb.onOutput?.(data.text, 'error');
        break;

      case 'error':
        setStatus((prev) => prev === 'loading' ? 'error' : 'ready');
        cb.onError?.(data.error);
        break;

      case 'done':
        clearTimeout(activityTimerRef.current);
        clearTimeout(hardStopTimerRef.current);
        setStatus('ready');
        cb.onDone?.();
        break;
    }
  }, []);

  /**
   * 구독 등록 (마운트 시)
   */
  useEffect(() => {
    const listener = { onMessage: handleMessage };
    unsubRef.current = singleton.subscribe(listener);
    return () => {
      unsubRef.current?.();
      clearTimeout(activityTimerRef.current);
      clearTimeout(hardStopTimerRef.current);
      // 언마운트 시에도 Worker는 유지 (싱글톤)
    };
  }, [handleMessage]);

  /**
   * Worker 초기화 (이미 ready면 즉시)
   */
  const initWorker = useCallback(() => {
    const currentStatus = singleton.getStatus();
    if (currentStatus === 'ready') {
      setStatus('ready');
      setProgress(100);
      cbRef.current.onReady?.();
      return;
    }
    setStatus('loading');
    singleton.initIfNeeded();
  }, []);

  /**
   * 코드 실행
   */
  const runCode = useCallback((rawCode) => {
    if (singleton.getStatus() !== 'ready') return;

    const { code, warnings } = preprocessCode(rawCode);
    if (warnings.length > 0) {
      warnings.forEach(w => cbRef.current.onOutput?.(`⚠️ ${w}`, 'warning'));
    }

    setStatus('running');
    singleton.setStatus('running');

    // 활동 타임아웃 설정
    activityTimerRef.current = setTimeout(() => {
      stopExecution();
      cbRef.current.onError?.('실행 시간 초과 (10초 무응답). 무한 루프에 rate()가 있는지 확인하세요.');
    }, ACTIVITY_TIMEOUT);

    singleton.runCode(code);
  }, []);

  /**
   * 실행 중지
   * 1단계: 소프트 스톱 (rate() 기반, Worker 유지)
   * 2단계: 3초 후 소프트 스톱 실패 시 하드 스톱 (terminate + 재생성)
   */
  const stopExecution = useCallback(() => {
    clearTimeout(activityTimerRef.current);
    clearTimeout(hardStopTimerRef.current);

    // 1단계: 소프트 스톱 시도
    singleton.softStop();

    // 2단계: 3초 내에 done이 안 오면 하드 스톱
    hardStopTimerRef.current = setTimeout(() => {
      singleton.hardStop();
      setStatus('idle');

      // Worker 재생성
      const listener = { onMessage: handleMessage };
      unsubRef.current = singleton.subscribe(listener);
      setStatus('loading');
      singleton.initIfNeeded();
    }, 3000);
  }, [handleMessage]);

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
