/**
 * 실행 화면이 공유하는 Python Worker입니다.
 * 마지막 화면이 떠나면 종료하고, 종료된 Worker의 늦은 메시지는 무시합니다.
 */
import vpythonApiRaw from './vpython-api.py?raw';
import transformRaw from './student-code-transform.py?raw';
import { warmPyodideCache } from '../lib/service-worker.js';

const INIT_TIMEOUT = 45_000;
let worker = null;
let status = 'idle';
let initialization = null;
let initializationTimer = null;
const listeners = new Set();
let runSeq = 0;
let activeRunId = 0;

function broadcast(message) {
  for (const listener of listeners) listener.onMessage(message);
}

function updateStatus(nextStatus) {
  status = nextStatus;
  broadcast({ type: 'status', status });
}

function settleInitialization(error) {
  clearTimeout(initializationTimer);
  initializationTimer = null;
  const pending = initialization;
  initialization = null;
  if (error) pending?.reject(error);
  else pending?.resolve();
}

function terminateWorker() {
  const previous = worker;
  worker = null;
  if (previous) {
    previous.onmessage = null;
    previous.onerror = null;
    previous.onmessageerror = null;
    previous.terminate();
  }
}

function failWorker(message, phase) {
  terminateWorker();
  updateStatus('error');
  settleInitialization(new Error(message));
  broadcast({ type: 'error', error: message, phase, fatal: true, ...(phase === 'runtime' ? { runId: activeRunId } : {}) });
}

function createWorker() {
  const instance = new Worker(new URL('./pyodide-worker.js', import.meta.url), { type: 'classic' });
  instance.onmessage = (event) => {
    if (instance !== worker) return;
    let message = event.data;
    if (typeof message === 'string') {
      try { message = JSON.parse(message); } catch { return; }
    }
    if (!message || typeof message !== 'object') return;
    if (message.runId != null && message.runId !== activeRunId) return;

    if (message.type === 'ready') {
      updateStatus('ready');
      settleInitialization();
      // 재방문 때 네트워크 없이 시작하도록 방금 받은 핵심 파일을 Service Worker 캐시에 둡니다.
      warmPyodideCache(message.source);
    } else if (message.type === 'error' && status === 'loading') {
      failWorker(message.error || 'Python 엔진을 준비하지 못했습니다.', 'init');
      return;
    } else if (message.type === 'event_start') {
      updateStatus('running');
    } else if (['done', 'error', 'event_done'].includes(message.type)) {
      updateStatus('ready');
    }
    broadcast(message);
  };
  instance.onerror = (event) => {
    if (instance !== worker) return;
    failWorker(`Worker 오류: ${event?.message || 'Python 엔진의 응답이 끊겼습니다.'}`, status === 'loading' ? 'init' : 'runtime');
  };
  instance.onmessageerror = () => {
    if (instance !== worker) return;
    failWorker('Python 엔진의 응답을 읽지 못했습니다. 다시 준비해 주세요.', status === 'loading' ? 'init' : 'runtime');
  };
  return instance;
}

/** 한 번만 시도하며, 실패하면 사용자가 직접 재시도합니다. */
export function initIfNeeded() {
  if (['ready', 'running', 'stopping'].includes(status)) return Promise.resolve();
  if (initialization) return initialization.promise;

  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  initialization = { promise, resolve, reject };
  updateStatus('loading');
  initializationTimer = setTimeout(() => {
    failWorker('Python 엔진 준비 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 준비해 주세요.', 'init');
  }, INIT_TIMEOUT);
  try {
    worker = createWorker();
    worker.postMessage({ type: 'init', vpythonApi: vpythonApiRaw, transformSource: transformRaw });
  } catch (error) {
    failWorker(`Python 엔진 초기화 실패: ${error.message}`, 'init');
  }
  return promise;
}

/** 실행 중이거나 정지 확인 중인 Worker에 다음 코드를 넣지 않습니다. */
export function runCode(code) {
  if (!worker || status !== 'ready') return null;
  activeRunId = ++runSeq;
  updateStatus('running');
  worker.postMessage({ type: 'run', code, runId: activeRunId });
  return activeRunId;
}

export function softStop() {
  if (!worker || status !== 'running') return false;
  updateStatus('stopping');
  worker.postMessage({ type: 'stop' });
  return true;
}

export function postEvent(payload) {
  if (worker && ['running', 'ready'].includes(status)) worker.postMessage({ type: 'event', payload });
}

export function postWidgetValue(id, value) {
  if (worker && ['running', 'ready'].includes(status)) worker.postMessage({ type: 'widget_value', id, value });
}

/** input() 입력 위젯의 답을 Worker에 보낸다. value가 null이면 취소(Python 쪽 EOFError). */
export function postInputValue(id, value) {
  if (worker && ['running', 'stopping'].includes(status)) worker.postMessage({ type: 'input_value', id, value });
}

export function postMouseState(pos, pick) {
  if (worker && ['running', 'ready'].includes(status)) worker.postMessage({ type: 'mouse', pos, pick });
}

export function postPressedKeys(keys) {
  if (worker && ['running', 'ready'].includes(status)) worker.postMessage({ type: 'keys', keys });
}

/** 카메라 상태를 Worker에 알린다. Python의 scene.camera.pos, scene.forward 읽기에 쓴다. */
export function postCameraState(state) {
  if (worker && ['running', 'ready'].includes(status)) worker.postMessage({ type: 'camera', state });
}

/** 구독은 유지하므로 종료 후 다시 준비해도 메시지가 유실되지 않습니다. */
export function hardStop() {
  terminateWorker();
  const error = new Error('Python 엔진 준비가 취소되었습니다.');
  error.name = 'AbortError';
  settleInitialization(error);
  activeRunId = 0;
  updateStatus('idle');
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) hardStop();
  };
}

export function prewarm() {
  if (status === 'idle') void initIfNeeded().catch(() => {});
}

export function getStatus() { return status; }

/** 이전 호출부와의 호환성을 위한 상태 전달 함수입니다. */
export function setStatus(nextStatus) { updateStatus(nextStatus); }
