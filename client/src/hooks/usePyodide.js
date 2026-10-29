import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessCode, mapGeneratedLine } from '../engine/code-preprocessor';
import { explainPythonError } from '../engine/python-error-explainer';
import * as singleton from '../engine/pyodide-singleton';

const ACTIVITY_TIMEOUT = 10_000;
const STOP_TIMEOUT = 750;

function getTimeoutMessage(code) {
  if (/while\s/.test(code) && !/rate\s*\(/.test(code)) {
    return '실행 시간 초과 (10초 무응답). while 루프 안에 rate()를 넣어주세요.';
  }
  return '실행 시간 초과 (10초 무응답). 반복문과 rate() 값을 확인하세요.';
}

/**
 * Worker가 보낸 구조화 오류를 원래 줄 번호로 되돌리고 입문자용 설명을 붙입니다.
 * @returns {{ message: string, raw: string, type: string, pyMessage: string, line: number|null, column: number|null, codeLine: string|null, frames: {line:number|null, name:string}[], explanation: {title:string, explanation:string, hint:string, line:number|null} }}
 */
export function buildErrorDetails(data, rawCode, lineMap, locale = 'ko') {
  const detail = data.detail || {};
  const sourceLines = String(rawCode || '').split('\n');
  const mapLine = (line) => (Array.isArray(lineMap) && lineMap.length ? mapGeneratedLine(lineMap, line) : line);
  const line = Number.isInteger(detail.line) ? mapLine(detail.line) : null;
  const codeLine = Number.isInteger(line) && sourceLines[line - 1] !== undefined ? sourceLines[line - 1] : (detail.sourceLine ?? null);
  const frames = Array.isArray(detail.frames) ? detail.frames.map((frame) => ({ line: mapLine(frame.line), name: frame.name })) : [];
  const type = detail.type || String(data.error || '').split(':')[0] || 'Error';
  const pyMessage = detail.message ?? String(data.error || '').replace(/^[^:]*:\s?/, '');
  const explanation = explainPythonError({ type, message: pyMessage, line, codeLine, column: detail.column ?? null, mapLine }, locale);
  return { message: String(data.error || ''), raw: data.raw || '', type, pyMessage, line, column: detail.column ?? null, codeLine, frames, explanation };
}

/** 실행 화면이 Worker를 소유하며 정지 확인 전에는 재실행을 허용하지 않습니다. */
export default function usePyodide({ onOutput, onError, onBatch, onReady, onDone, locale = 'ko' } = {}) {
  const [status, setStatus] = useState(singleton.getStatus);
  const [progress, setProgress] = useState(singleton.getStatus() === 'ready' ? 100 : 0);
  const [progressMessage, setProgressMessage] = useState('');
  const callbacksRef = useRef({ onOutput, onError, onBatch, onReady, onDone, locale });
  const timersRef = useRef({ activity: null, stop: null });
  const activeRunRef = useRef(0);
  const stoppingRef = useRef(false);
  const lastCodeRef = useRef('');
  const lastLineMapRef = useRef(null);
  const stopRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => { callbacksRef.current = { onOutput, onError, onBatch, onReady, onDone, locale }; });

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
      case 'error': {
        clearTimers();
        stoppingRef.current = false;
        // 파이썬 예외만 구조화 정보가 있다. 초기화·Worker 오류는 문자열 그대로 전달한다.
        if (data.detail) {
          callbacks.onError?.(data.error, buildErrorDetails(data, lastCodeRef.current, lastLineMapRef.current, callbacks.locale));
        } else {
          callbacks.onError?.(data.error);
        }
        break;
      }
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
    const { code, warnings, lineMap } = preprocessCode(rawCode);
    warnings.forEach((warning) => callbacksRef.current.onOutput?.(`⚠️ ${warning}`, 'warning'));
    clearTimers();
    stoppingRef.current = false;
    lastCodeRef.current = rawCode;
    lastLineMapRef.current = lineMap;
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
