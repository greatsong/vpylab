import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import source from './pyodide-worker.js?raw';

function createWorkerContext({ failImport = false, location = null, failLocal = false } = {}) {
  const python = { runPythonAsync: vi.fn(async () => {}), loadPackage: vi.fn(async () => {}) };
  const self = Object.create({ fetch: vi.fn(), WebSocket: vi.fn(), indexedDB: {}, caches: {} });
  self.postMessage = vi.fn();
  self.loadPyodide = vi.fn(async () => python);
  if (location) self.location = { href: location };
  const importScripts = vi.fn((url) => {
    if (failImport) throw new Error('연결 실패');
    if (failLocal && !/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//.test(url)) throw new Error('404');
  });
  runInNewContext(source, { self, importScripts, setTimeout, clearTimeout, URL });
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

  it('초기화 후 상속된 네트워크와 저장 API도 차단하고 fetch는 거부 가드로 바꾼다', async () => {
    const { self } = createWorkerContext();
    const original = self.fetch;
    expect(typeof self.fetch).toBe('function');
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    for (const key of ['WebSocket', 'indexedDB', 'XMLHttpRequest', 'importScripts', 'Worker', 'caches']) {
      expect(self[key]).toBeUndefined();
      expect(Object.getOwnPropertyDescriptor(self, key)).toMatchObject({ writable: false, configurable: false });
    }
    expect(self.fetch).not.toBe(original);
    expect(Object.getOwnPropertyDescriptor(self, 'fetch')).toMatchObject({ writable: false, configurable: false });
    // 학생 코드가 실행될 수 있는 평상시에는 어떤 주소도 거부합니다.
    await expect(self.fetch('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/numpy.whl')).rejects.toThrow('네트워크 요청');
    expect(original).not.toHaveBeenCalled();
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }));
  });

  it('패키지 설치 중에는 패키지 출처로만 fetch를 통과시킨다', async () => {
    const { self, python } = createWorkerContext({ location: 'https://vpylab.vercel.app/assets/pyodide-worker-abc.js' });
    const original = self.fetch;
    original.mockResolvedValue({ ok: true });
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    const seen = [];
    python.loadPackage.mockImplementation(async () => {
      seen.push(await self.fetch('https://vpylab.vercel.app/pyodide/v0.27.0/micropip-0.8.0-py3-none-any.whl'));
      seen.push(await self.fetch('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/numpy.whl'));
      seen.push(await self.fetch('https://files.pythonhosted.org/packages/x.whl'));
      await expect(self.fetch('https://vpylab.vercel.app/api/projects/commit')).rejects.toThrow('패키지 출처');
      await expect(self.fetch('https://evil.example/x.whl')).rejects.toThrow('패키지 출처');
    });
    await self.onmessage({ data: { type: 'run', runId: 3, code: 'import numpy as np\nprint(np.zeros(2))' } });
    expect(python.loadPackage).toHaveBeenCalledWith('micropip');
    expect(seen).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(original).toHaveBeenCalledTimes(3);
    // 설치가 끝나 학생 코드가 실행되는 동안에는 다시 거부합니다.
    await expect(self.fetch('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/numpy.whl')).rejects.toThrow('네트워크 요청');
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'done', runId: 3 }));
  });

  it('같은 출처의 /pyodide/v<버전>/을 먼저 쓰고 indexURL도 그 출처로 맞춘다', async () => {
    const { self, importScripts } = createWorkerContext({ location: 'https://vpylab.vercel.app/assets/pyodide-worker-abc.js' });
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    expect(importScripts).toHaveBeenCalledTimes(1);
    expect(importScripts).toHaveBeenCalledWith('https://vpylab.vercel.app/pyodide/v0.27.0/pyodide.js');
    expect(self.loadPyodide).toHaveBeenCalledWith({ indexURL: 'https://vpylab.vercel.app/pyodide/v0.27.0/' });
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', source: 'https://vpylab.vercel.app/pyodide/v0.27.0/', version: '0.27.0' }));
  });

  it('같은 출처에 파일이 없으면 한 번만 시도하고 CDN으로 넘어간다', async () => {
    const { self, importScripts } = createWorkerContext({ location: 'http://localhost:4033/src/engine/pyodide-worker.js', failLocal: true });
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    expect(importScripts.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4033/pyodide/v0.27.0/pyodide.js',
      'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js',
    ]);
    expect(self.loadPyodide).toHaveBeenCalledWith({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' });
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', source: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' }));
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
