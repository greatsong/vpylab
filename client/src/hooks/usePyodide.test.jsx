import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import usePyodide from './usePyodide';
import * as singleton from '../engine/pyodide-singleton';

let workers;
class FakeWorker {
  constructor() {
    this.postMessage = vi.fn();
    this.terminate = vi.fn();
    workers.push(this);
  }
  emit(message) { this.onmessage?.({ data: message }); }
}
function createRuntime(callbacks = {}) {
  const hook = renderHook(() => usePyodide(callbacks));
  act(() => { void hook.result.current.initWorker(); });
  return hook;
}
async function prepare(hook, worker = workers.at(-1)) {
  await act(async () => { worker.emit({ type: 'ready' }); });
  expect(hook.result.current.isReady).toBe(true);
}

describe('실제 Python hook와 싱글톤의 Worker 수명', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    workers = [];
    vi.stubGlobal('Worker', FakeWorker);
    singleton.hardStop();
  });
  afterEach(() => {
    cleanup(); singleton.hardStop(); vi.unstubAllGlobals(); vi.useRealTimers();
  });

  it('동시 초기화는 한 Worker를 공유하고 마지막 화면 이탈 때 종료한다', async () => {
    const first = createRuntime();
    const second = createRuntime();
    expect(workers).toHaveLength(1);
    expect(first.result.current.status).toBe('loading');
    act(() => { expect(first.result.current.runCode('print(1)')).toBeNull(); });
    await prepare(first);
    expect(second.result.current.isReady).toBe(true);
    act(() => { expect(first.result.current.runCode('print(1)')).toBeGreaterThan(0); });
    expect(first.result.current.isRunning).toBe(true);
    first.unmount();
    expect(workers[0].terminate).not.toHaveBeenCalled();
    second.unmount();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it('초기화 실패 후 자동 반복 없이 수동 재시도로 복구한다', async () => {
    const onError = vi.fn();
    const hook = createRuntime({ onError });
    await act(async () => { workers[0].emit({ type: 'error', error: 'CDN 연결 실패' }); });
    expect(hook.result.current.status).toBe('error');
    expect(onError).toHaveBeenCalledExactlyOnceWith('CDN 연결 실패');
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(workers).toHaveLength(1);
    act(() => { void hook.result.current.initWorker(); });
    expect(workers).toHaveLength(2);
    await prepare(hook);
  });

  it('초기화 무응답은 45초 뒤 실패하고 공유 Promise도 끝낸다', async () => {
    const hook = createRuntime();
    const settled = singleton.initIfNeeded().catch((error) => error.message);
    await act(async () => { vi.advanceTimersByTime(45_000); });
    expect(await settled).toContain('준비 시간이 초과');
    expect(hook.result.current.status).toBe('error');
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(1);
  });

  it('무한 루프 정지 직후 재실행을 차단하고 새 Worker 준비 후 허용한다', async () => {
    const onDone = vi.fn();
    const onOutput = vi.fn();
    const hook = createRuntime({ onDone, onOutput });
    await prepare(hook);
    let firstRun;
    act(() => { firstRun = hook.result.current.runCode('while True:\n    pass'); });
    const oldWorker = workers[0];
    const lateMessage = oldWorker.onmessage;
    act(() => { hook.result.current.stopExecution(); });
    expect(hook.result.current.status).toBe('stopping');
    expect(hook.result.current.isReady).toBe(false);
    act(() => { expect(hook.result.current.runCode('print(2)')).toBeNull(); });
    act(() => { vi.advanceTimersByTime(750); });
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(hook.result.current.status).toBe('loading');
    expect(onDone).toHaveBeenCalledExactlyOnceWith({ stopped: true });
    act(() => { lateMessage({ data: { type: 'stdout', runId: firstRun, text: '이전 출력' } }); });
    expect(onOutput).not.toHaveBeenCalled();
    await prepare(hook);
    let secondRun;
    act(() => { secondRun = hook.result.current.runCode('print(2)'); });
    expect(secondRun).toBeGreaterThan(firstRun);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(workers[1].terminate).not.toHaveBeenCalled();
    expect(hook.result.current.isRunning).toBe(true);
    act(() => { workers[1].emit({ type: 'done', runId: secondRun }); });
    expect(hook.result.current.isReady).toBe(true);
  });

  it('응답한 정지는 Worker를 재사용하며 정지 타이머를 취소한다', async () => {
    const onDone = vi.fn();
    const hook = createRuntime({ onDone });
    await prepare(hook);
    let runId;
    act(() => { runId = hook.result.current.runCode('while True:\n    rate(30)'); });
    act(() => { hook.result.current.stopExecution(); });
    act(() => { workers[0].emit({ type: 'done', runId }); });
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledExactlyOnceWith({ stopped: true });
    expect(hook.result.current.isReady).toBe(true);
  });

  it('화면 이탈은 무한 루프 Worker와 예약된 재시작을 모두 정리한다', async () => {
    const hook = createRuntime();
    await prepare(hook);
    act(() => { hook.result.current.runCode('while True:\n    pass'); });
    act(() => { hook.result.current.stopExecution(); });
    hook.unmount();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(workers).toHaveLength(1);
    expect(singleton.getStatus()).toBe('idle');
  });

  it('이전 실행의 오류와 출력은 새 실행 상태를 바꾸지 않는다', async () => {
    const onError = vi.fn();
    const onOutput = vi.fn();
    const hook = createRuntime({ onError, onOutput });
    await prepare(hook);
    let firstRun;
    let secondRun;
    act(() => { firstRun = hook.result.current.runCode('print(1)'); });
    act(() => { workers[0].emit({ type: 'done', runId: firstRun }); });
    act(() => { secondRun = hook.result.current.runCode('print(2)'); });
    act(() => {
      workers[0].emit({ type: 'error', runId: firstRun, error: '늦은 오류' });
      workers[0].emit({ type: 'stdout', runId: firstRun, text: '늦은 출력' });
    });
    expect(onError).not.toHaveBeenCalled(); expect(onOutput).not.toHaveBeenCalled();
    expect(hook.result.current.isRunning).toBe(true);
    act(() => { workers[0].emit({ type: 'stdout', runId: secondRun, text: '현재 출력' }); });
    expect(onOutput).toHaveBeenCalledExactlyOnceWith('현재 출력');
  });

  it('무응답 실행은 자동 종료하고 수정 가능한 오류를 전달한다', async () => {
    const onError = vi.fn();
    const hook = createRuntime({ onError });
    await prepare(hook);
    act(() => { hook.result.current.runCode('while True:\n    pass'); });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(hook.result.current.status).toBe('stopping');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('rate()'));
    act(() => { vi.advanceTimersByTime(750); });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(hook.result.current.status).toBe('loading');
  });

  it('본문이 끝난 뒤 실행된 이벤트 콜백도 정지와 무응답 감시를 제공한다', async () => {
    const hook = createRuntime();
    await prepare(hook);
    let runId;
    act(() => { runId = hook.result.current.runCode('scene.bind("click", handler)'); });
    act(() => { workers[0].emit({ type: 'done', runId }); });
    expect(hook.result.current.isReady).toBe(true);
    act(() => { workers[0].emit({ type: 'event_start', runId }); });
    expect(hook.result.current.isRunning).toBe(true);
    act(() => { hook.result.current.stopExecution(); });
    expect(hook.result.current.isReady).toBe(false);
    act(() => { vi.advanceTimersByTime(750); });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(hook.result.current.status).toBe('loading');
  });
});
