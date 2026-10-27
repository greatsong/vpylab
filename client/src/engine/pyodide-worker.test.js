import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import source from './pyodide-worker.js?raw';

function createWorkerContext({ failImport = false } = {}) {
  const python = { runPythonAsync: vi.fn(async () => {}), loadPackage: vi.fn(async () => {}) };
  const self = Object.create({ fetch: vi.fn(), WebSocket: vi.fn(), indexedDB: {} });
  self.postMessage = vi.fn();
  self.loadPyodide = vi.fn(async () => python);
  const importScripts = vi.fn(() => { if (failImport) throw new Error('연결 실패'); });
  runInNewContext(source, { self, importScripts, setTimeout, clearTimeout });
  return { self, python, importScripts };
}

describe('실제 Worker 스크립트의 출력 제한과 샌드박스', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('대량 print는 16KB로 제한하고 묶음 메시지로 전송한다', async () => {
    const { self } = createWorkerContext();
    for (let index = 0; index < 10_000; index++) self._queueOutput('stdout', 'x'.repeat(100));
    expect(self.postMessage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(75);
    const messages = self.postMessage.mock.calls.map(([message]) => message);
    expect(messages).toHaveLength(2);
    expect(messages[0].text.length).toBe(16_384);
    expect(messages[1].text).toContain('생략');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(self.postMessage).toHaveBeenCalledTimes(2);
  });

  it('실행 도중 출력하고 남은 출력도 done 전에 비운다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    self.postMessage.mockClear();
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code === '학생 코드') {
        self._queueOutput('stdout', '중간 출력\n');
        await vi.advanceTimersByTimeAsync(75);
        expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'stdout', runId: 7, text: '중간 출력' }));
        self._queueOutput('stderr', '마지막 출력\n');
      }
    });
    await self.onmessage({ data: { type: 'run', runId: 7, code: '학생 코드' } });
    const messages = self.postMessage.mock.calls.map(([message]) => message);
    expect(messages.at(-2)).toMatchObject({ type: 'stderr', runId: 7, text: '마지막 출력' });
    expect(messages.at(-1)).toMatchObject({ type: 'done', runId: 7 });
    expect(python.runPythonAsync.mock.calls.some(([code]) => code.includes('StringIO'))).toBe(false);
  });

  it('초기화 후 상속된 네트워크와 저장 API도 차단한다', async () => {
    const { self } = createWorkerContext();
    expect(typeof self.fetch).toBe('function');
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    for (const key of ['fetch', 'WebSocket', 'indexedDB', 'XMLHttpRequest', 'importScripts', 'Worker']) {
      expect(self[key]).toBeUndefined();
      expect(Object.getOwnPropertyDescriptor(self, key)).toMatchObject({ writable: false, configurable: false });
    }
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }));
  });

  it('CDN 실패는 정해진 횟수만 시도하고 초기화 오류를 전달한다', async () => {
    const { self, importScripts } = createWorkerContext({ failImport: true });
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    expect(importScripts).toHaveBeenCalledTimes(6);
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', error: expect.stringContaining('초기화 실패') }));
  });

  it('본문 종료 후 이벤트 콜백도 시작과 종료를 전달한다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    await self.onmessage({ data: { type: 'run', runId: 5, code: '학생 코드' } });
    self.postMessage.mockClear();
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code.includes('_process_pending_events()')) self._popEvent();
    });
    await self.onmessage({ data: { type: 'event', payload: { name: 'click' } } });
    expect(self.postMessage.mock.calls.map(([message]) => message.type)).toEqual(['event_start', 'event_done']);
  });
});
