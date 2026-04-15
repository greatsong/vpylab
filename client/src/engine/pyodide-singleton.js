/**
 * Pyodide Worker 싱글톤
 *
 * Worker를 앱 전역에서 1개만 유지하여 페이지 이동 시 재사용.
 * 코드 중지 시 rate() 기반 소프트 스톱을 먼저 시도하고,
 * 실패 시에만 Worker를 terminate + 재생성한다.
 */
import vpythonApiRaw from './vpython-api.py?raw';

let worker = null;
let status = 'idle'; // idle | loading | ready | running
let readyPromiseResolve = null;
let listeners = new Set(); // { onMessage: fn } 구독자 세트

function createWorker() {
  const w = new Worker(
    new URL('./pyodide-worker.js', import.meta.url),
    { type: 'classic' }
  );

  w.onmessage = (e) => {
    let msg = e.data;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch { return; }
    }

    if (msg.type === 'ready') {
      status = 'ready';
      if (readyPromiseResolve) {
        readyPromiseResolve();
        readyPromiseResolve = null;
      }
    }

    if (msg.type === 'done' || msg.type === 'error') {
      if (status === 'running') status = 'ready';
    }

    // 모든 구독자에게 메시지 전달
    for (const listener of listeners) {
      listener.onMessage(msg);
    }
  };

  w.onerror = (err) => {
    status = 'idle';
    const message = err?.message || err?.reason || (typeof err === 'string' ? err : '알 수 없는 오류');
    for (const listener of listeners) {
      listener.onMessage({ type: 'error', error: `Worker 오류: ${message}` });
    }
  };

  return w;
}

/**
 * Worker 초기화 (이미 ready면 즉시 반환)
 */
export function initIfNeeded() {
  if (status === 'ready') return Promise.resolve();
  if (status === 'loading') {
    // 이미 로딩 중이면 ready 될 때까지 대기
    return new Promise((resolve) => {
      const prev = readyPromiseResolve;
      readyPromiseResolve = () => {
        prev?.();
        resolve();
      };
    });
  }

  status = 'loading';
  worker = createWorker();

  worker.postMessage({
    type: 'init',
    vpythonApi: vpythonApiRaw,
  });

  return new Promise((resolve) => {
    readyPromiseResolve = resolve;
  });
}

/**
 * 코드 실행
 */
export function runCode(code) {
  if (!worker || status !== 'ready') return;
  status = 'running';
  worker.postMessage({ type: 'run', code });
}

/**
 * 소프트 스톱 — rate() 내부에서 중단 신호를 감지
 * Worker를 유지하므로 재로딩 없음
 */
export function softStop() {
  if (!worker) return;
  worker.postMessage({ type: 'stop' });
}

/**
 * 하드 스톱 — Worker terminate + 재생성
 * 소프트 스톱이 실패했을 때의 fallback
 */
export function hardStop() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  status = 'idle';
  listeners.clear();
}

/**
 * 구독자 등록/해제
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Prewarm — Worker를 미리 생성하고 초기화 시작
 * 아직 Worker가 없을 때만 동작 (idle 상태일 때)
 */
export function prewarm() {
  if (status === 'idle') {
    initIfNeeded();
  }
}

/**
 * 현재 상태 조회
 */
export function getStatus() {
  return status;
}

export function setStatus(s) {
  status = s;
}
