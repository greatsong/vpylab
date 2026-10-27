import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import RuntimePanel from './RuntimePanel';
import * as singleton from '../engine/pyodide-singleton';

vi.mock('../components/viewport/Viewport3D', () => ({
  default: function MockViewport({ sceneRef, onSceneReady }) {
    useEffect(() => {
      const scene = { _cameraSystem: { onCodeStart: vi.fn() } };
      sceneRef.current = scene;
      onSceneReady(scene);
    }, [sceneRef, onSceneReady]);
    return <div data-testid="viewport">3D 화면</div>;
  },
}));
vi.mock('../engine/vpython-bridge', () => ({ processBatch: vi.fn(), clearScene: vi.fn() }));
vi.mock('../engine/object-registry', () => ({ clearRegistry: vi.fn() }));
vi.mock('../engine/sound-system', () => ({
  ensureAudioResumed: vi.fn(), stopAllSounds: vi.fn(), resumeAndRun: (callback) => callback(),
}));

let workers;
class FakeWorker {
  constructor() {
    this.postMessage = vi.fn(); this.terminate = vi.fn(); workers.push(this);
  }
  emit(message) { this.onmessage?.({ data: message }); }
}
async function ready() { await act(async () => { workers.at(-1).emit({ type: 'ready' }); }); }
function currentRun() { return workers.at(-1).postMessage.mock.calls.map(([message]) => message).findLast((message) => message.type === 'run').runId; }

describe('교실 Python 실행 화면', () => {
  beforeEach(() => { workers = []; vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); singleton.hardStop(); });
  afterEach(() => { cleanup(); singleton.hardStop(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('콘솔은 최근 200줄과 32KB를 유지하고 HTML을 텍스트로 표시한다', async () => {
    render(<RuntimePanel code="print(1)" />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    const runId = currentRun();
    act(() => {
      for (let index = 0; index < 260; index++) workers[0].emit({ type: 'stdout', runId, text: `${index}: ${'x'.repeat(200)}` });
      workers[0].emit({ type: 'stdout', runId, text: '<img src=x onerror=alert(1)>' });
    });
    const consoleElement = screen.getByLabelText('실행 출력');
    expect(consoleElement.children.length).toBeLessThanOrEqual(200);
    expect(consoleElement.textContent.length).toBeLessThanOrEqual(32_768 + 200);
    expect(consoleElement.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(consoleElement.querySelector('img')).toBeNull();
    expect([...consoleElement.children].some((line) => line.textContent.startsWith('0: '))).toBe(false);
  });

  it('실행 완료 증거는 실행 당시 코드와 출력으로 기록한다', async () => {
    const onRunResult = vi.fn();
    const view = render(<RuntimePanel code="print('원본')" onRunResult={onRunResult} />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    const runId = currentRun();
    view.rerender(<RuntimePanel code="print('수정본')" onRunResult={onRunResult} />);
    act(() => {
      workers[0].emit({ type: 'stdout', runId, text: '원본' });
      workers[0].emit({ type: 'done', runId });
    });
    expect(onRunResult).toHaveBeenCalledOnce();
    expect(onRunResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', code: "print('원본')", output: expect.arrayContaining([{ text: '원본', type: 'log' }]) }));
  });

  it('정지 확인 중에는 준비 완료 표시와 실행 버튼을 허용하지 않는다', async () => {
    render(<RuntimePanel code="while True:\n    pass" />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    fireEvent.click(screen.getByRole('button', { name: '■ 정지' }));
    expect(screen.getByRole('status')).toHaveTextContent('실행 종료 확인 중');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(750); });
    expect(screen.getByRole('status')).toHaveTextContent('Python 준비 중');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    await ready();
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeEnabled();
  });

  it('초기화 실패를 알려주고 수동 엔진 준비를 제공한다', async () => {
    render(<RuntimePanel code="print(1)" />);
    await act(async () => { workers[0].emit({ type: 'error', error: '학교 네트워크 연결 실패' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('학교 네트워크 연결 실패');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '엔진 다시 준비' }));
    expect(workers).toHaveLength(2);
    await ready();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
