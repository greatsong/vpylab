import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessCode } from '../engine/code-preprocessor';
import * as singleton from '../engine/pyodide-singleton';

const ACTIVITY_TIMEOUT = 10_000;
const STOP_TIMEOUT = 750;

function getTimeoutMessage(code) {
  if (/while\s/.test(code) && !/rate\s*\(/.test(code)) {
    return '실행 시간 초과 (10초 무응답). while 루프 안에 rate()를 넣어주세요.';
  }
  return '실행 시간 초과 (10초 무응답). 반복문과 rate() 값을 확인하세요.';
}

/** 실행 화면이 Worker를 소유하며 정지 확인 전에는 재실행을 허용하지 않습니다. */
export default function usePyodide({ onOutput, onError, onBatch, onReady, onDone } = {}) {
  const [status, setStatus] = useState(singleton.getStatus);
  const [progress, setProgress] = useState(singleton.getStatus() === 'ready' ? 100 : 0);
  const [progressMessage, setProgressMessage] = useState('');
  const callbacksRef = useRef({ onOutput, onError, onBatch, onReady, onDone });
  const timersRef = useRef({ activity: null, stop: null });
  const activeRunRef = useRef(0);
  const stoppingRef = useRef(false);
  const lastCodeRef = useRef('');
  const stopRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => { callbacksRef.current = { onOutput, onError, onBatch, onReady, onDone }; });

  const clearTimers = useCallback(() => {
    clearTimeout(timersRef.current.activity);
    clearTimeout(timersRef.current.stop);
    timersRef.current = { activity: null, stop: null };
  }, []);

  const armActivityTimer = useCallback(() => {
    clearTimeout(timersRef.current.activity);
    timersRef.current.activity = setTimeout(() => {
      stopRef.current?.();
      callbacksRef.current.onError?.(getTimeoutMessage(lastCodeRef.current));
    }, ACTIVITY_TIMEOUT);
  }, []);

  const handleMessage = useCallback((message) => {
    const { type, ...data } = message;
    if (data.runId != null && data.runId !== activeRunRef.current) return;
    const callbacks = callbacksRef.current;
    if (['batch', 'stdout', 'stderr'].includes(type) && singleton.getStatus() === 'running') armActivityTimer();

    switch (type) {
      case 'status':
        setStatus(data.status);
        break;
      case 'progress':
        setProgress(data.percent);
        setProgressMessage(data.message);
        break;
      case 'ready':
        setProgress(100);
        callbacks.onReady?.();
        break;
      case 'stdout':
        callbacks.onOutput?.(data.text);
        break;
      case 'stderr':
        callbacks.onOutput?.(data.text, 'error');
        break;
      case 'batch':
        if (data.commands?.length) callbacks.onBatch?.(data.commands);
        break;
      case 'event_start':
        armActivityTimer();
        break;
      case 'event_done': {
        clearTimers();
        const stopped = stoppingRef.current || data.stopped;
        stoppingRef.current = false;
        if (stopped) callbacks.onDone?.({ stopped: true });
        break;
      }
      case 'error':
        clearTimers();
        stoppingRef.current = false;
        callbacks.onError?.(data.error);
        break;
      case 'done': {
        clearTimers();
        const stopped = stoppingRef.current;
        stoppingRef.current = false;
        callbacks.onDone?.({ stopped });
        break;
      }
    }
  }, [armActivityTimer, clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = singleton.subscribe({ onMessage: handleMessage });
    return () => {
      mountedRef.current = false;
      clearTimers();
      unsubscribe();
    };
  }, [handleMessage, clearTimers]);

  const initWorker = useCallback(() => {
    if (singleton.getStatus() === 'ready') {
      setStatus('ready');
      setProgress(100);
      callbacksRef.current.onReady?.();
      return Promise.resolve();
    }
    setProgress(0);
    setProgressMessage('Python 실행 환경을 준비합니다.');
    // 실패는 Worker 메시지로 한 번만 전달합니다. 취소는 화면 이탈일 수 있습니다.
    return singleton.initIfNeeded().catch(() => {});
  }, []);

  const stopExecution = useCallback(() => {
    if (!singleton.softStop()) return;
    clearTimers();
    stoppingRef.current = true;
    timersRef.current.stop = setTimeout(() => {
      activeRunRef.current = 0;
      stoppingRef.current = false;
      singleton.hardStop();
      if (!mountedRef.current) return;
      callbacksRef.current.onDone?.({ stopped: true });
      setProgress(0);
      setProgressMessage('실행을 종료했습니다. Python 엔진을 다시 준비합니다.');
      void singleton.initIfNeeded().catch(() => {});
    }, STOP_TIMEOUT);
  }, [clearTimers]);

  useEffect(() => { stopRef.current = stopExecution; }, [stopExecution]);

  const runCode = useCallback((rawCode) => {
    if (singleton.getStatus() !== 'ready') return null;
    const { code, warnings } = preprocessCode(rawCode);
    warnings.forEach((warning) => callbacksRef.current.onOutput?.(`⚠️ ${warning}`, 'warning'));
    clearTimers();
    stoppingRef.current = false;
    lastCodeRef.current = rawCode;
    const runId = singleton.runCode(code);
    if (runId) {
      activeRunRef.current = runId;
      armActivityTimer();
    }
    return runId;
  }, [armActivityTimer, clearTimers]);

  return {
    status, progress, progressMessage, initWorker, runCode, stopExecution,
    isLoading: status === 'loading',
    isReady: status === 'ready',
    isRunning: status === 'running',
    isStopping: status === 'stopping',
  };
}
