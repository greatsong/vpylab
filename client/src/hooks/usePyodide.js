import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessCode } from '../engine/code-preprocessor';
import * as singleton from '../engine/pyodide-singleton';

/**
 * 타임아웃 메시지를 코드 내용에 맞게 생성
 */
function getTimeoutMessage(code) {
  const hasWhileLoop = /while\s/.test(code);
  const hasRate = /rate\s*\(/.test(code);
  if (hasWhileLoop && !hasRate) {
    return '실행 시간 초과 (10초 무응답). while 루프 안에 rate()를 넣어주세요.';
  }
  if (hasWhileLoop && hasRate) {
    return '실행 시간 초과 (10초 무응답). rate() 값을 확인하거나 무한 루프를 점검하세요.';
  }
  return '실행 시간 초과 (10초 무응답). 코드가 너무 오래 걸리거나 응답이 없습니다.';
}

/**
 * Pyodide Worker 관리 훅 (싱글톤 기반)
 *
 * - 전역 Worker 1개를 공유하여 페이지 이동 시 재로딩 없음
 * - 소프트 스톱(rate 기반 중단) 우선, 실패 시 하드 스톱(terminate)
 * - micropip은 필요할 때만 지연 로딩
 */
export default function usePyodide({ onOutput, onError, onBatch, onReady, onDone }) {
  const [status, setStatus] = useState(() => {
    const s = singleton.getStatus();
    return s === 'running' ? 'ready' : s; // 이전 세션의 running은 ready로 취급
  });
  const [progress, setProgress] = useState(singleton.getStatus() === 'ready' ? 100 : 0);
  const [progressMessage, setProgressMessage] = useState('');
  const hardStopTimerRef = useRef(null);
  const activityTimerRef = useRef(null);
  const unsubRef = useRef(null);

  const ACTIVITY_TIMEOUT = 10_000;
  const lastCodeRef = useRef('');   // 마지막 실행 코드 (타임아웃 메시지 분기용)
  const stopRef = useRef(null);     // doStopExecution ref (선언 순서 문제 해결)

  // 콜백 refs (최신 값 유지)
  const cbRef = useRef({ onOutput, onError, onBatch, onReady, onDone });
  useEffect(() => {
    cbRef.current = { onOutput, onError, onBatch, onReady, onDone };
  });

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
          stopRef.current?.();
          cb.onError?.(getTimeoutMessage(lastCodeRef.current));
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

      case 'batch':
        if (data.commands) {
          cb.onBatch?.(data.commands);
        }
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

  // 소프트 + 하드 스톱 로직
  const doStopExecution = useCallback(() => {
    clearTimeout(activityTimerRef.current);
    clearTimeout(hardStopTimerRef.current);

    // 1단계: 소프트 스톱 시도
    singleton.softStop();
    setStatus('ready'); // 즉시 ready로 전환 (로딩 화면 안 보이게)

    // 2단계: 3초 내에 done이 안 오면 하드 스톱
    hardStopTimerRef.current = setTimeout(() => {
      singleton.hardStop();
      // Worker 재생성 + 재구독 (status는 ready 유지 — 로딩 화면 방지)
      unsubRef.current?.();
      const listener = { onMessage: handleMessage };
      unsubRef.current = singleton.subscribe(listener);
      // 백그라운드에서 Worker 재초기화 (로딩 화면 없이)
      singleton.initIfNeeded();
    }, 3000);
  }, [handleMessage]);

  // ref에 최신 stop 함수 등록 (handleMessage에서 안전하게 접근)
  useEffect(() => {
    stopRef.current = doStopExecution;
  }, [doStopExecution]);

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

    // 활동 타임아웃 설정
    lastCodeRef.current = rawCode;
    activityTimerRef.current = setTimeout(() => {
      doStopExecution();
      cbRef.current.onError?.(getTimeoutMessage(rawCode));
    }, ACTIVITY_TIMEOUT);

    singleton.runCode(code);
  }, [doStopExecution]);

  /**
   * 실행 중지 (외부 API)
   */
  const stopExecution = useCallback(() => {
    doStopExecution();
  }, [doStopExecution]);

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
