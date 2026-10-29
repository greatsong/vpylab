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

describe('실제 Worker 스크립트의 트레이스백 구조화', () => {
  function pythonError(type, traceback) {
    const error = new Error(traceback);
    error.type = type;
    return error;
  }

  it('학생 코드에는 파일 이름을 붙이고, 가장 안쪽 학생 프레임의 줄 번호를 보낸다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    const apiCall = python.runPythonAsync.mock.calls.find(([code]) => code === '# API');
    expect(apiCall[1]).toEqual({ filename: '<vpython-api>' });
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code !== '학생 코드') return;
      throw pythonError('KeyError', [
        'Traceback (most recent call last):',
        '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
        '    await CodeRunner(',
        '  File "<student>", line 8, in <module>',
        '  File "<student>", line 4, in __vpylab_main__',
        '  File "<vpython-api>", line 279, in __getitem__',
        'KeyError: "\'핑크색\' 색상을 찾을 수 없습니다. 사용 가능: 빨, 빨강..."',
        '',
      ].join('\n'));
    });
    await self.onmessage({ data: { type: 'run', runId: 3, code: '학생 코드' } });
    const studentCall = python.runPythonAsync.mock.calls.find(([code]) => code === '학생 코드');
    expect(studentCall[1]).toEqual({ filename: '<student>' });
    const message = self.postMessage.mock.calls.map(([entry]) => entry).find((entry) => entry.type === 'error');
    expect(message.runId).toBe(3);
    expect(message.error).toBe('KeyError: "\'핑크색\' 색상을 찾을 수 없습니다. 사용 가능: 빨, 빨강..."');
    expect(message.detail).toMatchObject({
      type: 'KeyError',
      message: '"\'핑크색\' 색상을 찾을 수 없습니다. 사용 가능: 빨, 빨강..."',
      line: 4,
      frames: [{ line: 8, name: '<module>' }, { line: 4, name: '__vpylab_main__' }],
    });
  });

  it('SyntaxError는 소스 줄과 ^ 위치(열)를 함께 보낸다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code !== '학생 코드') return;
      throw pythonError('SyntaxError', [
        'Traceback (most recent call last):',
        '  File "/lib/python312.zip/_pyodide/_base.py", line 149, in _parse_and_compile_gen',
        '    mod = compile(source, filename, mode, flags | ast.PyCF_ONLY_AST)',
        '  File "<student>", line 2',
        '    if x > 3',
        '            ^',
        "SyntaxError: expected ':'",
      ].join('\n'));
    });
    await self.onmessage({ data: { type: 'run', runId: 4, code: '학생 코드' } });
    const message = self.postMessage.mock.calls.map(([entry]) => entry).find((entry) => entry.type === 'error');
    expect(message.detail).toMatchObject({ type: 'SyntaxError', message: "expected ':'", line: 2, column: 9, sourceLine: 'if x > 3', frames: [] });
  });

  it('message가 빈 PythonError는 stderr 버퍼 끝의 트레이스백을 떼어 내 사용한다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    self.postMessage.mockClear();
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code !== '학생 코드') return;
      self._queueOutput('stderr', '학생이 직접 쓴 경고\n');
      self._queueOutput('stderr', 'Traceback (most recent call last):\n  File "<student>", line 2, in <module>\nNameError: name \'spd\' is not defined\n');
      throw pythonError('NameError', '');
    });
    await self.onmessage({ data: { type: 'run', runId: 6, code: '학생 코드' } });
    const messages = self.postMessage.mock.calls.map(([entry]) => entry);
    expect(messages.filter((entry) => entry.type === 'stderr')).toEqual([expect.objectContaining({ text: '학생이 직접 쓴 경고' })]);
    const error = messages.find((entry) => entry.type === 'error');
    expect(error.error).toBe("NameError: name 'spd' is not defined");
    expect(error.raw).toContain('Traceback');
    expect(error.detail).toMatchObject({ type: 'NameError', message: "name 'spd' is not defined", line: 2 });
  });

  it('message가 빈 _StopExecution도 stderr 트레이스백으로 정지를 알아본다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    self.postMessage.mockClear();
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code !== '학생 코드') return;
      self._queueOutput('stderr', 'Traceback (most recent call last):\n  File "<student>", line 3, in __vpylab_main__\n_StopExecution: 실행이 중지되었습니다\n');
      throw pythonError('_StopExecution', '');
    });
    await self.onmessage({ data: { type: 'run', runId: 7, code: '학생 코드' } });
    const types = self.postMessage.mock.calls.map(([entry]) => entry.type);
    expect(types).not.toContain('error');
    expect(types).not.toContain('stderr');
    expect(types).toContain('done');
  });

  it('Pyodide가 종류를 알려 주지 않아도 마지막 줄에서 종류를 읽는다', async () => {
    const { self, python } = createWorkerContext();
    await self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code === '학생 코드') throw new Error('Traceback (most recent call last):\n  File "<student>", line 1, in <module>\nZeroDivisionError: division by zero\n');
    });
    await self.onmessage({ data: { type: 'run', runId: 5, code: '학생 코드' } });
    const message = self.postMessage.mock.calls.map(([entry]) => entry).find((entry) => entry.type === 'error');
    expect(message.detail).toMatchObject({ type: 'ZeroDivisionError', message: 'division by zero', line: 1 });
  });
});
